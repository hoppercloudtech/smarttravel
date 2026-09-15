// lib/google/candidateQueue.ts
//
// Manages the GooglePlaceCandidate quarantine queue. A candidate is only
// created if dedup matching didn't find an existing Place already covering
// it — otherwise we'd be queueing "new" places an admin would just reject
// as duplicates.

import { prisma } from "@/lib/prisma";
import { findLikelyExistingPlace } from "@/lib/google/dedup";
import type { GooglePlaceResult } from "@/lib/google/places";
import { guessCategoryFromGoogleTypes } from "@/lib/google/mapping";


// Matches Google's 30-day coordinate storage limit — gives the whole Google
// integration one consistent retention window rather than several arbitrary
// numbers. An unreviewed candidate this old is stale enough to re-discover
// fresh rather than trust.
const CANDIDATE_RETENTION_DAYS = 30;

export type UpsertResult =
    | { outcome: "matched_existing"; placeId: string }
    | { outcome: "queued"; candidateId: string }
    | { outcome: "already_queued"; candidateId: string };

export async function upsertGoogleCandidate(
    place: GooglePlaceResult,
    opts: { source: string; regionKey?: string }
): Promise<UpsertResult> {
    if (!place.location || !place.displayName?.text) {
        throw new Error("Google place result missing location or displayName — cannot queue.");
    }

    const existingCandidate = await prisma.googlePlaceCandidate.findUnique({ where: { googlePlaceId: place.id } });
    if (existingCandidate) {
        return existingCandidate.status === "PROMOTED" && existingCandidate.promotedPlaceId
            ? { outcome: "matched_existing", placeId: existingCandidate.promotedPlaceId }
            : { outcome: "already_queued", candidateId: existingCandidate.id };
    }

    // Dedup against real HorizonSpot places before queueing anything new.
    const match = await findLikelyExistingPlace(place.displayName.text, place.location.latitude, place.location.longitude);
    if (match) {
        return { outcome: "matched_existing", placeId: match.id };
    }

    const candidate = await prisma.googlePlaceCandidate.create({
        data: {
            googlePlaceId: place.id,
            displayNameRaw: place.displayName.text,
            categoryGuess: guessCategoryFromGoogleTypes(place.types),
            latitude: place.location.latitude,
            longitude: place.location.longitude,
            rawTypes: place.types ?? [],
            source: opts.source,
            regionKey: opts.regionKey,
            expiresAt: new Date(Date.now() + CANDIDATE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        },
    });

    return { outcome: "queued", candidateId: candidate.id };
}

/** Marks unreviewed candidates past their retention window as EXPIRED. Called by the cleanup cron. */
export async function expireStaleCandidates(): Promise<number> {
    const result = await prisma.googlePlaceCandidate.updateMany({
        where: { status: "NEW", expiresAt: { lt: new Date() } },
        data: { status: "EXPIRED" },
    });
    return result.count;
}