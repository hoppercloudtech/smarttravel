// lib/places/relatedPlaces.ts
//
// Popularity-first "Related Places" recommendation engine.
// Scoped to the current place's country (every level in the product spec
// stays within-country), fetched in a single query, then ranked with a
// continuous weighted score so popular-but-farther places can outrank
// close-but-unpopular ones — no hard geo cutoffs, no randomness.

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PlaceCategory } from "@prisma/client";

const RELATED_PLACES_LIMIT = 8;
const CANDIDATE_POOL_SIZE = 400; // bounds compute cost even for large countries
const CACHE_REVALIDATE_SECONDS = 6 * 60 * 60; // recompute periodically as viewCount changes

// Popularity dominates; category next; geography is a secondary signal.
// See HorizonSpot Related Places spec, section 4.
const WEIGHTS = {
    popularity: 0.5,
    category: 0.25,
    proximity: 0.15,
    localArea: 0.1,
} as const;

const PROXIMITY_DECAY_KM = 25; // distance at which proximity score ≈ 0.5
const NEUTRAL_PROXIMITY_SCORE = 0.4; // used when either side is missing coordinates

export type RelatedPlacesInput = {
    id: string;
    category: PlaceCategory;
    countryId: string;
    cityId: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
};

export type RelatedPlaceItem = {
    id: string;
    slug: string;
    name: string;
    category: PlaceCategory;
    cityName: string | null;
    countryName: string;
    heroImageUrl: string | null;
};

type Candidate = {
    id: string;
    slug: string;
    name: string;
    category: PlaceCategory;
    cityId: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    viewCount: number;
    city: { name: string } | null;
    country: { name: string };
    media: { url: string }[];
};

type ScoredCandidate = RelatedPlaceItem & {
    _score: number;
    _viewCount: number;
    _distanceKm: number | null;
};

/** Great-circle distance in km. No external API calls — coordinates only. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

function scoreCandidates(current: RelatedPlacesInput, candidates: Candidate[]): ScoredCandidate[] {
    if (candidates.length === 0) return [];

    // Log-normalized against the pool's own max so no single place with a
    // huge viewCount can dominate every page forever (spec section 5).
    const maxLogViews = Math.max(...candidates.map((c) => Math.log(1 + c.viewCount)), 1e-6);

    return candidates.map((c) => {
        const popularityScore = Math.log(1 + c.viewCount) / maxLogViews;
        const categoryScore = c.category === current.category ? 1 : 0;

        let distanceKm: number | null = null;
        let proximityScore = NEUTRAL_PROXIMITY_SCORE;
        if (current.latitude != null && current.longitude != null && c.latitude != null && c.longitude != null) {
            distanceKm = haversineKm(current.latitude, current.longitude, c.latitude, c.longitude);
            proximityScore = PROXIMITY_DECAY_KM / (PROXIMITY_DECAY_KM + distanceKm);
        }

        let localAreaScore = 0;
        if (current.cityId && c.cityId && current.cityId === c.cityId) {
            localAreaScore = 1;
        } else if (
            current.district &&
            c.district &&
            current.district.trim().toLowerCase() === c.district.trim().toLowerCase()
        ) {
            localAreaScore = 0.5;
        }

        const score =
            WEIGHTS.popularity * popularityScore +
            WEIGHTS.category * categoryScore +
            WEIGHTS.proximity * proximityScore +
            WEIGHTS.localArea * localAreaScore;

        return {
            id: c.id,
            slug: c.slug,
            name: c.name,
            category: c.category,
            cityName: c.city?.name ?? null,
            countryName: c.country.name,
            heroImageUrl: c.media[0]?.url ?? null,
            _score: score,
            _viewCount: c.viewCount,
            _distanceKm: distanceKm,
        };
    });
}

/** Deterministic — no Math.random(), no random SQL ordering (spec section 21). */
function rankAndTrim(scored: ScoredCandidate[], limit: number): RelatedPlaceItem[] {
    const sorted = [...scored].sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        if (b._viewCount !== a._viewCount) return b._viewCount - a._viewCount;
        const ad = a._distanceKm ?? Infinity;
        const bd = b._distanceKm ?? Infinity;
        if (ad !== bd) return ad - bd;
        return a.name.localeCompare(b.name);
    });

    return sorted.slice(0, limit).map(({ _score, _viewCount, _distanceKm, ...item }) => item);
}

async function fetchCandidatePool(current: RelatedPlacesInput): Promise<Candidate[]> {
    return prisma.place.findMany({
        where: {
            id: { not: current.id },
            status: "PUBLISHED",
            countryId: current.countryId,
        },
        select: {
            id: true,
            slug: true,
            name: true,
            category: true,
            cityId: true,
            district: true,
            latitude: true,
            longitude: true,
            viewCount: true,
            city: { select: { name: true } },
            country: { select: { name: true } },
            media: { where: { isHero: true }, take: 1, select: { url: true } },
        },
        orderBy: { viewCount: "desc" },
        take: CANDIDATE_POOL_SIZE,
    });
}

async function computeRelatedPlaces(current: RelatedPlacesInput, limit: number): Promise<RelatedPlaceItem[]> {
    const candidates = await fetchCandidatePool(current);
    const scored = scoreCandidates(current, candidates);
    return rankAndTrim(scored, limit);
}

/**
 * Public entry point. Pass the fields already available on a loaded Place
 * record (no extra query needed on the page side). Cached per-place and
 * revalidated periodically so rankings can evolve with viewCount without
 * ever going permanently stale.
 */
export async function getRelatedPlaces(
    place: RelatedPlacesInput,
    limit: number = RELATED_PLACES_LIMIT
): Promise<RelatedPlaceItem[]> {
    const cached = unstable_cache(
        async () => computeRelatedPlaces(place, limit),
        ["related-places", place.id, String(limit)],
        { revalidate: CACHE_REVALIDATE_SECONDS, tags: [`related-places:${place.id}`] }
    );
    return cached();
}