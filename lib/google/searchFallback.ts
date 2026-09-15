// lib/google/searchFallback.ts
//
// Called ONLY from the full search-results page (app/(site)/search/page.tsx)
// when Neon has zero matches for a real search submission — NEVER from the
// autocomplete-as-you-type endpoint (app/api/search/route.ts), which stays
// Neon-only. Every keystroke hitting Google would be uncontrolled spend;
// a deliberate search submission with no local results is the appropriate
// trigger point.
//
// Cost controls, in order:
//   1. Query length floor — short/junk queries never reach Google.
//   2. GoogleSearchLog cooldown — the same normalized query, from ANY user,
//      won't re-hit Google within GOOGLE_SEARCH_COOLDOWN_HOURS. This is the
//      main defense: popular repeated searches only cost once per window,
//      globally, not once per visitor.
//   3. Every result is queued into GooglePlaceCandidate (deduped against
//      existing Places first) so future discovery/search doesn't need to
//      re-ask Google about the same place at all once it's known.

import { prisma } from "@/lib/prisma";
import { textSearchPlaces, buildGoogleAttribution, type GooglePlaceResult } from "@/lib/google/places";
import { upsertGoogleCandidate } from "@/lib/google/candidateQueue";

const MIN_QUERY_LENGTH = 3;
const COOLDOWN_HOURS = Number(process.env.GOOGLE_SEARCH_COOLDOWN_HOURS ?? 24);

function normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export type SearchFallbackResult = {
    results: (GooglePlaceResult & { attribution: ReturnType<typeof buildGoogleAttribution> })[];
    skippedReason: "too_short" | "cooldown" | null;
};

export async function searchGoogleFallback(query: string, regionCode?: string): Promise<SearchFallbackResult> {
    if (query.trim().length < MIN_QUERY_LENGTH) {
        return { results: [], skippedReason: "too_short" };
    }

    const normalized = normalizeQuery(query);
    const existingLog = await prisma.googleSearchLog.findUnique({ where: { normalizedQuery: normalized } });

    if (existingLog) {
        const hoursSinceLastQuery = (Date.now() - existingLog.lastQueriedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastQuery < COOLDOWN_HOURS) {
            return { results: [], skippedReason: "cooldown" };
        }
    }

    const places = await textSearchPlaces(query, { regionCode, maxResultCount: 5 });

    await prisma.googleSearchLog.upsert({
        where: { normalizedQuery: normalized },
        update: { lastQueriedAt: new Date(), resultCount: places.length, queryCount: { increment: 1 } },
        create: { normalizedQuery: normalized, resultCount: places.length },
    });

    // Queue each result for admin review — fire-and-forget, never blocks the
    // response the user is waiting on. Dedup against existing Places happens
    // inside upsertGoogleCandidate.
    for (const place of places) {
        upsertGoogleCandidate(place, { source: "google-search-fallback" }).catch((err) => {
            console.error("Failed to queue Google search-fallback candidate:", err);
        });
    }

    return {
        results: places.map((p) => ({ ...p, attribution: buildGoogleAttribution(p) })),
        skippedReason: null,
    };
}