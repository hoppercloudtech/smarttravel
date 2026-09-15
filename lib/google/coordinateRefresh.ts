// lib/google/coordinateRefresh.ts
//
// Google's policy permits caching Places coordinates for up to 30 days, then
// they must be refreshed or deleted. This only applies to Places whose
// coordinates genuinely came from Google (coordinatesSource: "google") —
// OSM/manual/Nominatim-sourced coordinates are unaffected, since that data
// isn't Google Maps Content and has no such restriction.

import { prisma } from "@/lib/prisma";
import { refreshPlaceLocation } from "@/lib/google/places";

const COORDINATE_CACHE_DAYS = 30;

export async function refreshExpiredGoogleCoordinates(): Promise<{ checked: number; refreshed: number; cleared: number }> {
    const cutoff = new Date(Date.now() - COORDINATE_CACHE_DAYS * 24 * 60 * 60 * 1000);

    const expiring = await prisma.place.findMany({
        where: { coordinatesSource: "google", coordinatesCachedAt: { lt: cutoff }, googlePlaceId: { not: null } },
    });

    let refreshed = 0;
    let cleared = 0;

    for (const place of expiring) {
        try {
            const location = await refreshPlaceLocation(place.googlePlaceId!);

            if (location) {
                await prisma.place.update({
                    where: { id: place.id },
                    data: { latitude: location.latitude, longitude: location.longitude, coordinatesCachedAt: new Date() },
                });
                refreshed++;
            } else {
                // Google no longer returns this place_id — clear the Google-sourced
                // coordinates entirely rather than keep data past its permitted
                // retention window. If the place still exists on HorizonSpot for
                // another reason (e.g. now corroborated by OSM), that source's own
                // coordinates take over on the next OSM ingestion pass.
                await prisma.place.update({
                    where: { id: place.id },
                    data: { latitude: null, longitude: null, coordinatesSource: null, coordinatesCachedAt: null },
                });
                cleared++;
            }
        } catch {
            // Leave as-is on a transient API failure — picked up again on the next cleanup run.
        }
    }

    return { checked: expiring.length, refreshed, cleared };
}