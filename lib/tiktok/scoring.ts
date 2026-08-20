// lib/tiktok/scoring.ts
//
// Computes a base score (0-1) for a single Place as a TikTok post candidate.
// Diversity (category/geographic) is NOT scored here — it depends on what's
// already been picked for today's batch, so it's applied as a greedy penalty
// during selection in lib/tiktok/queueBuilder.ts, not as a static per-place
// property.
//
// Formula per the project brief: rating/review/booking/click metrics aren't
// in the current schema — only Place.viewCount and Place.featured exist
// today. This is written as a clean abstraction so richer engagement
// metrics (bookings, clicks, search frequency) can be added to the weighted
// sum later without changing the function's shape — just add a term.

export type ScoringWeights = {
    popularity: number;
    freshness: number;
    imageQuality: number;
    categoryDiversity: number; // read here for documentation completeness; applied in queueBuilder.ts
    geoDiversity: number; // same
};

export type ScoringCandidate = {
    id: string;
    viewCount: number;
    featured: boolean;
    createdAt: Date;
    updatedAt: Date;
    mediaCount: number;
    hasHeroImage: boolean;
};

export type ScoreBreakdown = {
    total: number;
    popularity: number;
    freshness: number;
    imageQuality: number;
};

/** Normalizes a value against the max seen in the current candidate batch — cheap min-max scaling, no magic constants. */
function normalize(value: number, max: number): number {
    if (max <= 0) return 0;
    return Math.min(1, value / max);
}

/** Recency score: 1.0 for something updated today, decaying linearly to 0 at `maxAgeDays`. */
function freshnessScore(updatedAt: Date, maxAgeDays = 180): number {
    const ageDays = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - ageDays / maxAgeDays);
}

/** Image quality proxy: more photos + a designated hero image = more usable for a carousel post. */
function imageQualityScore(mediaCount: number, hasHeroImage: boolean): number {
    const countScore = Math.min(1, mediaCount / 5); // 5+ photos = full score
    const heroBonus = hasHeroImage ? 0.2 : 0;
    return Math.min(1, countScore * 0.8 + heroBonus);
}

/**
 * Scores one candidate against the rest of the current batch (needed for
 * popularity normalization — "popular" is relative to what else is eligible
 * today, not an absolute threshold).
 */
export function scoreCandidate(
    candidate: ScoringCandidate,
    maxViewCountInBatch: number,
    weights: ScoringWeights
): ScoreBreakdown {
    const popularityBase = normalize(candidate.viewCount, maxViewCountInBatch);
    const popularity = candidate.featured ? Math.min(1, popularityBase + 0.15) : popularityBase;

    const freshness = freshnessScore(candidate.updatedAt);
    const imageQuality = imageQualityScore(candidate.mediaCount, candidate.hasHeroImage);

    const total =
        popularity * weights.popularity +
        freshness * weights.freshness +
        imageQuality * weights.imageQuality;
    // categoryDiversity and geoDiversity weights are applied as selection-time
    // penalties in queueBuilder.ts, not folded into this static total.

    return { total, popularity, freshness, imageQuality };
}