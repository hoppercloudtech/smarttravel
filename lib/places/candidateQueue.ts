// lib/places/candidateQueue.ts
//
// Provider-agnostic version of lib/google/candidateQueue.ts's upsert logic.
// Deliberately a SEPARATE file rather than a shared refactor of the
// existing one — a small amount of duplication here is the safer tradeoff
// against risking any behavior change to the working, tested Google-only
// path. Both write to the same GooglePlaceCandidate table (no duplicate
// table created), disambiguated by the `provider` field.

import { prisma } from "@/lib/prisma";
import { findLikelyExistingPlace } from "@/lib/google/dedup";
import type { DiscoveredPlace } from "@/lib/places/types";

const CANDIDATE_RETENTION_DAYS = 30;

export type UpsertResult =
    | { outcome: "matched_existing"; placeId: string }
    | { outcome: "queued"; candidateId: string }
    | { outcome: "already_queued"; candidateId: string };

export async function upsertPlaceCandidate(
    place: DiscoveredPlace,
    opts: { source: string; regionKey?: string }
): Promise<UpsertResult> {
    const existingCandidate = await prisma.googlePlaceCandidate.findUnique({ where: { googlePlaceId: place.sourcePlaceId } });
    if (existingCandidate) {
        return existingCandidate.status === "PROMOTED" && existingCandidate.promotedPlaceId
            ? { outcome: "matched_existing", placeId: existingCandidate.promotedPlaceId }
            : { outcome: "already_queued", candidateId: existingCandidate.id };
    }

    const match = await findLikelyExistingPlace(place.name, place.latitude, place.longitude);
    if (match) {
        return { outcome: "matched_existing", placeId: match.id };
    }

    const candidate = await prisma.googlePlaceCandidate.create({
        data: {
            googlePlaceId: place.sourcePlaceId, // holds whichever provider's own place id — see `provider` for which one
            provider: place.source,
            displayNameRaw: place.name,
            categoryGuess: place.categoryGuess,
            latitude: place.latitude,
            longitude: place.longitude,
            rawTypes: place.rawCategories,
            source: opts.source,
            regionKey: opts.regionKey,
            expiresAt: new Date(Date.now() + CANDIDATE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        },
    });

    return { outcome: "queued", candidateId: candidate.id };
}