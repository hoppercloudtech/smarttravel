// lib/seo/opportunity.ts
//
// SEO Opportunity evaluation (Section 5) — evaluates only real, existing
// (country, city, category) combinations that already have Place data.
// Never brute-forces every theoretical combination (Section 31/33's
// scalability and "derive from real data" requirements).

import { prisma } from "@/lib/prisma";
import type { PlaceCategory } from "@prisma/client";

export type OpportunityRecommendation = "CREATE" | "OPTIMIZE" | "MONITOR" | "DO_NOT_CREATE";

export type LocationCategoryOpportunity = {
    countryId: string;
    countryName: string;
    cityId: string | null;
    cityName: string | null;
    category: PlaceCategory;
    placeCount: number;
    dataCompleteness: number; // 0-1
    qualityScore: number; // 0-100
    recommendation: OpportunityRecommendation;
};

const MIN_PLACES_FOR_CREATE = 3;
const MIN_COMPLETENESS_FOR_CREATE = 0.5;

export async function evaluateLocationCategoryOpportunities(): Promise<LocationCategoryOpportunity[]> {
    const grouped = await prisma.place.groupBy({
        by: ["countryId", "cityId", "category"],
        where: { status: "PUBLISHED" },
        _count: { _all: true },
    });

    const results: LocationCategoryOpportunity[] = [];

    for (const group of grouped) {
        const places = await prisma.place.findMany({
            where: { countryId: group.countryId, cityId: group.cityId ?? undefined, category: group.category, status: "PUBLISHED" },
            include: { country: true, city: true, media: true, summaries: { where: { isCurrent: true } } },
        });

        const placeCount = places.length;
        const completenessScores = places.map((p) => {
            let score = 0;
            const total = 4;
            if (p.description) score++;
            if (Array.isArray(p.amenities) && (p.amenities as unknown[]).length > 0) score++;
            if (p.media.length > 0) score++;
            if (p.summaries.length > 0) score++;
            return score / total;
        });
        const dataCompleteness = completenessScores.reduce((a, b) => a + b, 0) / (completenessScores.length || 1);

        const qualityScore = Math.round(Math.min(1, placeCount / MIN_PLACES_FOR_CREATE) * 60 + dataCompleteness * 40);

        let recommendation: OpportunityRecommendation;
        if (placeCount >= MIN_PLACES_FOR_CREATE && dataCompleteness >= MIN_COMPLETENESS_FOR_CREATE) recommendation = "CREATE";
        else if (placeCount >= MIN_PLACES_FOR_CREATE) recommendation = "OPTIMIZE";
        else if (placeCount >= 1) recommendation = "MONITOR";
        else recommendation = "DO_NOT_CREATE";

        results.push({
            countryId: group.countryId,
            countryName: places[0]?.country.name ?? "",
            cityId: group.cityId,
            cityName: places[0]?.city?.name ?? null,
            category: group.category,
            placeCount,
            dataCompleteness,
            qualityScore,
            recommendation,
        });
    }

    return results.sort((a, b) => b.qualityScore - a.qualityScore);
}