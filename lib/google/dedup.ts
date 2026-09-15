// lib/google/dedup.ts
//
// Matches a Google-discovered candidate (or a live search fallback result)
// against places already in Neon, so "Serena Hotel", "Serena hotel Kampala",
// and "Serena Kampala" can resolve to the same existing Place rather than
// creating a duplicate or unnecessarily hitting Google again.
//
// Uses Postgres trigram similarity (pg_trgm) combined with a coordinate
// bounding-box prefilter — cheap, index-backed, no exact-string assumption.
// REQUIRES the pg_trgm extension and a GIN index — see setup notes.

import { prisma } from "@/lib/prisma";

const SIMILARITY_THRESHOLD = 0.35; // trigram similarity, 0-1. Tuned loose enough to catch "Serena Kampala" vs "Serena Hotel"
const PROXIMITY_DEGREES = 0.02; // ~2.2km bounding box — generous enough for slightly-off coordinates, tight enough to avoid cross-city false matches

export type ExistingPlaceMatch = {
    id: string;
    name: string;
    slug: string;
    category: string;
    similarity: number;
};

/**
 * Looks for a Place already in Neon that's plausibly the same real-world
 * place as the given name/coordinates. Returns the best match above the
 * similarity threshold, or null if nothing close enough was found.
 */
export async function findLikelyExistingPlace(
    name: string,
    latitude: number,
    longitude: number
): Promise<ExistingPlaceMatch | null> {
    const results = await prisma.$queryRaw<ExistingPlaceMatch[]>`
    SELECT id, name, slug, category, similarity(name, ${name}) AS similarity
    FROM places
    WHERE latitude BETWEEN ${latitude - PROXIMITY_DEGREES} AND ${latitude + PROXIMITY_DEGREES}
      AND longitude BETWEEN ${longitude - PROXIMITY_DEGREES} AND ${longitude + PROXIMITY_DEGREES}
      AND similarity(name, ${name}) > ${SIMILARITY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT 1;
  `;

    return results[0] ?? null;
}

/** Same idea, scoped for the search-fallback path where we only have a query string, not coordinates yet. */
export async function findLikelyExistingPlaceByNameOnly(name: string): Promise<ExistingPlaceMatch | null> {
    const results = await prisma.$queryRaw<ExistingPlaceMatch[]>`
    SELECT id, name, slug, category, similarity(name, ${name}) AS similarity
    FROM places
    WHERE similarity(name, ${name}) > ${SIMILARITY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT 1;
  `;

    return results[0] ?? null;
}