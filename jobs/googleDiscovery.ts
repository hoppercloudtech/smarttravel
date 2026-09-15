// jobs/googleDiscovery.ts
//
// Parallel to jobs/ingest.ts's Overpass pipeline, but deliberately NOT the
// same function — Google's output must never be auto-persisted as a real
// Place the way Overpass's is. This only ever populates GooglePlaceCandidate.
// Reuses the existing IngestionBatch/IngestionLog models for observability
// so the admin dashboard's ingestion history stays in one place.

import { prisma } from "@/lib/prisma";
import { getRegion } from "@/lib/regions";
import { nearbySearchPlaces } from "@/lib/google/places";
import { CATEGORY_TO_GOOGLE_TYPES } from "@/lib/google/mapping";
import { upsertGoogleCandidate } from "@/lib/google/candidateQueue";
import type { PlaceCategory } from "@prisma/client";

// A region's bbox center, with a radius approximating that bbox — Nearby
// Search takes a center+radius, not a bounding box, so this is a reasonable
// conversion rather than an exact one.
function regionToCenterAndRadius(bbox: [number, number, number, number]) {
    const [south, west, north, east] = bbox;
    const latitude = (south + north) / 2;
    const longitude = (west + east) / 2;
    // Rough degrees→meters conversion, generous but bounded — good enough for
    // a discovery sweep, not for precision geofencing.
    const latMeters = ((north - south) * 111_000) / 2;
    const radiusMeters = Math.min(50_000, Math.max(1_000, latMeters)); // Google caps Nearby Search radius at 50km
    return { latitude, longitude, radiusMeters };
}

export async function runGoogleDiscoveryBatch(opts: { regionKey: string; category: PlaceCategory; limit?: number }) {
    const region = getRegion(opts.regionKey);
    const includedTypes = CATEGORY_TO_GOOGLE_TYPES[opts.category];

    const batch = await prisma.ingestionBatch.create({
        data: {
            label: `google-${region.label}-${opts.category}-${new Date().toISOString().slice(0, 10)}`,
            country: region.label,
            category: opts.category,
            status: "RUNNING",
        },
    });

    const log = (data: { stage: string; status: string; message?: string }) =>
        prisma.ingestionLog.create({ data: { batchId: batch.id, ...data } });

    if (includedTypes.length === 0) {
        await prisma.ingestionBatch.update({ where: { id: batch.id }, data: { status: "SUCCEEDED", finishedAt: new Date() } });
        await log({ stage: "discover", status: "skipped", message: `No Google place types mapped for category ${opts.category} — skipped.` });
        return { skipped: true, reason: `${opts.category} has no Google Places equivalent.`, queued: 0 };
    }

    let queued = 0;
    let matchedExisting = 0;
    let alreadyQueued = 0;
    let failed = 0;

    try {
        const { latitude, longitude, radiusMeters } = regionToCenterAndRadius(region.bbox);
        const places = await nearbySearchPlaces({ latitude, longitude, radiusMeters, includedTypes, maxResultCount: opts.limit ?? 20 });

        await log({ stage: "discover", status: "success", message: `Google returned ${places.length} candidates for ${region.label}/${opts.category}.` });

        for (const place of places) {
            try {
                const result = await upsertGoogleCandidate(place, { source: "google-places-discovery", regionKey: region.key });
                if (result.outcome === "queued") queued++;
                else if (result.outcome === "matched_existing") matchedExisting++;
                else alreadyQueued++;
            } catch (err) {
                failed++;
                await log({ stage: "persist", status: "failed", message: err instanceof Error ? err.message : "Unknown error queueing candidate." });
            }
        }

        await prisma.ingestionBatch.update({
            where: { id: batch.id },
            data: {
                status: failed > 0 ? "PARTIAL" : "SUCCEEDED",
                totalFound: places.length,
                totalInserted: queued,
                totalSkipped: matchedExisting + alreadyQueued,
                totalFailed: failed,
                finishedAt: new Date(),
            },
        });
    } catch (err) {
        await prisma.ingestionBatch.update({ where: { id: batch.id }, data: { status: "FAILED", finishedAt: new Date() } });
        await log({ stage: "discover", status: "failed", message: err instanceof Error ? err.message : "Unknown error" });
        throw err;
    }

    return { skipped: false, queued, matchedExisting, alreadyQueued, failed };
}