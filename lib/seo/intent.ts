// lib/seo/intent.ts
//
// Search Intent as a first-class structure (Section 4). This is a
// deterministic BUILDER for known page contexts, not a query-parsing NLP
// classifier — turning raw free-text search queries into this structure is
// a distinct, larger capability that needs real query data (Search Console)
// to build and validate against. Deferred until that data exists, rather
// than shipped as a fake classifier.

export type IntentType = "location-discovery" | "proximity" | "filtered-discovery" | "activity-discovery" | "entity";

export interface SearchIntent {
    location?: string;
    category?: string;
    subcategory?: string;
    attribute?: string;
    proximityTarget?: string;
    intentType: IntentType;
    confidence: number; // 0-1 — always 1 here since this is constructed, not inferred from ambiguous text
}

export function buildLocationCategoryIntent(opts: { locationLabel: string; categoryLabel: string; attribute?: string }): SearchIntent {
    return {
        location: opts.locationLabel,
        category: opts.categoryLabel,
        attribute: opts.attribute,
        intentType: opts.attribute ? "filtered-discovery" : "location-discovery",
        confidence: 1,
    };
}