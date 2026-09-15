// lib/places/placeService.ts
//
// The Google → Geoapify fallback logic itself. Two entry points, mirroring
// the two real integration points that already existed:
//   - discoverPlacesWithFallback: background/cron discovery (Nearby Search → Geoapify Places)
//   - searchPlacesWithFallback: live search fallback (Text Search → Geoapify Geocoding)
//
// Geoapify is only ever called when Google throws OR returns zero usable
// results — never in parallel, never speculatively.

import { prisma } from "@/lib/prisma";
import { getRegion, regionToCenterAndRadius } from "@/lib/regions";
import { nearbySearchPlaces, textSearchPlaces, buildGoogleAttribution } from "@/lib/google/places";
import { CATEGORY_TO_GOOGLE_TYPES } from "@/lib/google/mapping";
import { searchNearbyGeoapify, searchTextGeoapify } from "@/lib/geoapify/places";
import { CATEGORY_TO_GEOAPIFY_CATEGORIES } from "@/lib/geoapify/mapping";
import { fromGooglePlaceResult, fromGeoapifyFeature } from "@/lib/places/adapters";
import { upsertPlaceCandidate } from "@/lib/places/candidateQueue";
import type { DiscoveredPlace, PlaceProvider } from "@/lib/places/types";
import type { PlaceCategory } from "@prisma/client";

export type DiscoveryResult = { provider: PlaceProvider | "none"; places: DiscoveredPlace[] };

/**
 * Background/cron discovery for one region+category. Tries Google Nearby
 * Search; falls back to Geoapify Places only if Google throws or returns
 * nothing usable.
 */
export async function discoverPlacesWithFallback(opts: { regionKey: string; category: PlaceCategory; limit?: number }): Promise<DiscoveryResult> {
    const region = getRegion(opts.regionKey);
    const { latitude, longitude, radiusMeters } = regionToCenterAndRadius(region.bbox);

    const googleTypes = CATEGORY_TO_GOOGLE_TYPES[opts.category];
    if (googleTypes.length > 0) {
        console.log(`[Places] Trying Google Places for ${region.label}/${opts.category}`);
        try {
            const googleResults = await nearbySearchPlaces({ latitude, longitude, radiusMeters, includedTypes: googleTypes, maxResultCount: opts.limit ?? 20 });
            const mapped = googleResults.map(fromGooglePlaceResult).filter((p): p is DiscoveredPlace => p !== null);
            if (mapped.length > 0) {
                console.log(`[Places] Google Places succeeded (${mapped.length} results)`);
                return { provider: "google", places: mapped };
            }
            console.log("[Places] Google Places returned no usable results");
        } catch (err) {
            console.error("[Places] Google Places failed:", err instanceof Error ? err.message : "unknown error");
        }
    } else {
        console.log(`[Places] No Google category mapping for ${opts.category} — skipping straight to Geoapify`);
    }

    console.log("[Places] Falling back to Geoapify");
    const geoapifyCategories = CATEGORY_TO_GEOAPIFY_CATEGORIES[opts.category];
    if (geoapifyCategories.length === 0) {
        console.log(`[Places] No Geoapify category mapping for ${opts.category} either — both providers unavailable for this category`);
        return { provider: "none", places: [] };
    }

    try {
        const geoapifyResults = await searchNearbyGeoapify({ latitude, longitude, radiusMeters, categories: geoapifyCategories, limit: opts.limit ?? 20 });
        const mapped = geoapifyResults.map(fromGeoapifyFeature).filter((p): p is DiscoveredPlace => p !== null);
        console.log(mapped.length > 0 ? `[Places] Geoapify succeeded (${mapped.length} results)` : "[Places] Geoapify returned no results");
        return { provider: mapped.length > 0 ? "geoapify" : "none", places: mapped };
    } catch (err) {
        console.error("[Places] Geoapify fallback failed:", err instanceof Error ? err.message : "unknown error");
        return { provider: "none", places: [] };
    }
}

/**
 * Runs discovery with fallback AND queues every result into the candidate
 * table, deduped against existing Places — the full pipeline a cron/admin
 * trigger actually wants, not just the raw provider call.
 */
export async function runDiscoveryAndQueue(opts: { regionKey: string; category: PlaceCategory; limit?: number }) {
    const { provider, places } = await discoverPlacesWithFallback(opts);

    let queued = 0, matchedExisting = 0, alreadyQueued = 0, failed = 0;
    for (const place of places) {
        try {
            const result = await upsertPlaceCandidate(place, { source: `${provider}-places-discovery`, regionKey: opts.regionKey });
            if (result.outcome === "queued") queued++;
            else if (result.outcome === "matched_existing") matchedExisting++;
            else alreadyQueued++;
        } catch {
            failed++;
        }
    }

    return { provider, found: places.length, queued, matchedExisting, alreadyQueued, failed };
}

const MIN_QUERY_LENGTH = 3;
const COOLDOWN_HOURS = Number(process.env.GOOGLE_SEARCH_COOLDOWN_HOURS ?? 24);

function normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export type SearchFallbackDisplayResult = {
    id: string;
    name: string;
    address?: string;
    provider: PlaceProvider;
    attributionText: string;
    mapsUri?: string;
};

export type SearchWithFallbackResult = {
    results: SearchFallbackDisplayResult[];
    providerUsed: PlaceProvider | "none";
    skippedReason: "too_short" | "cooldown" | null;
};

/**
 * Live search fallback. Same cooldown table as before (GoogleSearchLog) —
 * shared across both providers deliberately, so a query that fails on
 * Google and succeeds on Geoapify doesn't get double the query budget.
 */
export async function searchPlacesWithFallback(query: string, countryCode?: string): Promise<SearchWithFallbackResult> {
    if (query.trim().length < MIN_QUERY_LENGTH) {
        return { results: [], providerUsed: "none", skippedReason: "too_short" };
    }

    const normalized = normalizeQuery(query);
    const existingLog = await prisma.googleSearchLog.findUnique({ where: { normalizedQuery: normalized } });
    if (existingLog) {
        const hoursSince = (Date.now() - existingLog.lastQueriedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < COOLDOWN_HOURS) {
            return { results: [], providerUsed: "none", skippedReason: "cooldown" };
        }
    }

    let provider: PlaceProvider | "none" = "none";
    let discovered: DiscoveredPlace[] = [];
    let display: SearchFallbackDisplayResult[] = [];

    console.log(`[Places] Trying Google Places for search "${query}"`);
    try {
        const googleResults = await textSearchPlaces(query, { regionCode: countryCode, maxResultCount: 5 });
        if (googleResults.length > 0) {
            provider = "google";
            discovered = googleResults.map(fromGooglePlaceResult).filter((p): p is DiscoveredPlace => p !== null);
            display = googleResults.map((r) => ({
                id: r.id,
                name: r.displayName?.text ?? "Unknown",
                address: r.formattedAddress,
                provider: "google" as const,
                attributionText: buildGoogleAttribution(r).text,
                mapsUri: r.googleMapsUri,
            }));
            console.log(`[Places] Google Places succeeded (${display.length} results)`);
        } else {
            console.log("[Places] Google Places returned no usable results");
        }
    } catch (err) {
        console.error("[Places] Google Places failed:", err instanceof Error ? err.message : "unknown error");
    }

    if (display.length === 0) {
        console.log("[Places] Falling back to Geoapify");
        try {
            const geoapifyResults = await searchTextGeoapify(query, { countryCode, limit: 5 });
            if (geoapifyResults.length > 0) {
                provider = "geoapify";
                discovered = geoapifyResults.map(fromGeoapifyFeature).filter((p): p is DiscoveredPlace => p !== null);
                display = discovered.map((p) => ({
                    id: p.sourcePlaceId,
                    name: p.name,
                    address: p.address,
                    provider: "geoapify" as const,
                    attributionText: "Listing data provided by Geoapify / OpenStreetMap contributors",
                }));
                console.log(`[Places] Geoapify succeeded (${display.length} results)`);
            } else {
                console.log("[Places] Geoapify returned no results — both providers unavailable");
            }
        } catch (err) {
            console.error("[Places] Geoapify fallback failed:", err instanceof Error ? err.message : "unknown error");
            console.error("[Places] Both providers unavailable");
        }
    }

    await prisma.googleSearchLog.upsert({
        where: { normalizedQuery: normalized },
        update: { lastQueriedAt: new Date(), resultCount: display.length, queryCount: { increment: 1 } },
        create: { normalizedQuery: normalized, resultCount: display.length },
    });

    for (const place of discovered) {
        upsertPlaceCandidate(place, { source: `${provider}-search-fallback` }).catch((err) => {
            console.error("[Places] Failed to queue search-fallback candidate:", err);
        });
    }

    return { results: display, providerUsed: display.length > 0 ? provider : "none", skippedReason: null };
}