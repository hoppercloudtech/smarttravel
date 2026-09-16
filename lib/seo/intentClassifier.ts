// lib/seo/intentClassifier.ts
//
// Classifies REAL, synced Search Console query strings against known
// locations/categories already in the database — structured extraction,
// not fabricated NLP. Only classifies what it can match with confidence;
// unmatched queries stay unclassified rather than guessed.

import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";
import type { SearchIntent } from "@/lib/seo/intent";

export async function classifyStoredQuery(query: string): Promise<SearchIntent | null> {
    const lower = query.toLowerCase();

    const cities = await prisma.city.findMany({ select: { name: true } });
    const matchedCity = cities.find((c) => lower.includes(c.name.toLowerCase()));

    const categoryEntry = Object.entries(CATEGORY_CONFIG).find(
        ([, cfg]) => lower.includes(cfg.label.toLowerCase()) || lower.includes(cfg.pluralLabel.toLowerCase())
    );

    if (!matchedCity && !categoryEntry) return null;

    const proximityMatch = lower.match(/near ([a-z\s]+)/);

    return {
        location: matchedCity?.name,
        category: categoryEntry?.[1].label,
        proximityTarget: proximityMatch?.[1]?.trim(),
        intentType: proximityMatch ? "proximity" : matchedCity && categoryEntry ? "location-discovery" : "entity",
        confidence: matchedCity && categoryEntry ? 0.9 : 0.5,
    };
}