// lib/seo/proximityOpportunity.ts
//
// Evaluates landmark+category combinations — the PROXIMITY page type.
// Reuses the same haversine approach as the existing Nearby-relation
// algorithm in jobs/ingest.ts, applied against admin-curated Landmarks
// instead of place-to-place distance.

import { prisma } from "@/lib/prisma";
import type { PlaceCategory } from "@prisma/client";
import type { OpportunityRecommendation } from "@/lib/seo/opportunity";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const MIN_PLACES_FOR_CREATE = 3;

export type ProximityOpportunity = {
    landmarkId: string;
    landmarkName: string;
    category: PlaceCategory;
    placeCount: number;
    recommendation: OpportunityRecommendation;
    qualityScore: number;
};

export async function evaluateProximityOpportunities(): Promise<ProximityOpportunity[]> {
    const landmarks = await prisma.landmark.findMany();
    const categories: PlaceCategory[] = ["HOTEL", "RESORT", "RESTAURANT", "GUEST_HOUSE", "APARTMENT", "ATTRACTION"];
    const results: ProximityOpportunity[] = [];

    for (const landmark of landmarks) {
        const nearbyPlaces = await prisma.place.findMany({
            where: { status: "PUBLISHED", latitude: { not: null }, longitude: { not: null } },
        });

        for (const category of categories) {
            const matches = nearbyPlaces.filter(
                (p) => p.category === category && haversineKm(landmark.latitude, landmark.longitude, p.latitude!, p.longitude!) <= landmark.radiusKm
            );

            const placeCount = matches.length;
            const recommendation: OpportunityRecommendation = placeCount >= MIN_PLACES_FOR_CREATE ? "CREATE" : placeCount >= 1 ? "MONITOR" : "DO_NOT_CREATE";
            const qualityScore = Math.round(Math.min(1, placeCount / MIN_PLACES_FOR_CREATE) * 100);

            if (placeCount > 0) {
                results.push({ landmarkId: landmark.id, landmarkName: landmark.name, category, placeCount, recommendation, qualityScore });
            }
        }
    }

    return results.sort((a, b) => b.qualityScore - a.qualityScore);
}