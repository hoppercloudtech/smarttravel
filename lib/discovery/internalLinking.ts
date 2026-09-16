// lib/discovery/internalLinking.ts
//
// Extends (does not replace) the existing NearbyRelation algorithm in
// jobs/ingest.ts. That system already computes place-to-place proximity —
// this adds a "what to explore next" layer combining it with category
// transitions and, where applicable, a link to the relevant discovery page.
// Deliberately simple, deterministic weights (Section 40: only score where
// it produces measurable value) rather than a heavy ML-style ranker.

import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";
import type { PlaceCategory } from "@prisma/client";

export type IntentTransition = {
    label: string;
    href: string;
    score: number;
};

const WEIGHT_DIFFERENT_CATEGORY_SAME_AREA = 90;
const WEIGHT_SAME_CATEGORY_NEARBY = 75;
const WEIGHT_LOCATION_CATEGORY_PAGE = 65;

export async function getIntentTransitions(placeId: string): Promise<IntentTransition[]> {
    const place = await prisma.place.findUniqueOrThrow({
        where: { id: placeId },
        include: {
            city: true,
            country: true,
            nearbyFrom: { include: { toPlace: { include: { city: true, country: true } } }, orderBy: { rank: "asc" }, take: 10 },
        },
    });

    const transitions: IntentTransition[] = [];

    for (const rel of place.nearbyFrom) {
        const isSameCategory = rel.toPlace.category === place.category;
        transitions.push({
            label: `${isSameCategory ? "More" : CATEGORY_CONFIG[rel.toPlace.category].pluralLabel} ${isSameCategory ? CATEGORY_CONFIG[rel.toPlace.category].pluralLabel.toLowerCase() : ""} near ${place.name}`.trim(),
            href: `/${CATEGORY_CONFIG[rel.toPlace.category].slug}/${rel.toPlace.slug}`,
            score: isSameCategory ? WEIGHT_SAME_CATEGORY_NEARBY : WEIGHT_DIFFERENT_CATEGORY_SAME_AREA,
        });
    }

    if (place.cityId) {
        const otherCategories: PlaceCategory[] = ["HOTEL", "RESTAURANT", "ATTRACTION"].filter((c) => c !== place.category) as PlaceCategory[];
        for (const category of otherCategories) {
            const discoveryPage = await prisma.discoveryPage.findFirst({ where: { cityId: place.cityId, category, status: "INDEXABLE" } });
            if (discoveryPage) {
                transitions.push({ label: discoveryPage.title.split(" | ")[0], href: `/discover/${discoveryPage.slug}`, score: WEIGHT_LOCATION_CATEGORY_PAGE });
            }
        }
    }

    return transitions.sort((a, b) => b.score - a.score).slice(0, 6);
}