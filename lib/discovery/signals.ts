// lib/discovery/signals.ts
//
// Real, computed signals only — no fabricated ratings/popularity (Section
// 11's explicit rule). Batch-computed (jobs/discoverySignals.ts), never
// live per-request (Section 27).

import { computePlaceSeoHealth } from "@/lib/seo/health";
import type { Place } from "@prisma/client";

function freshnessScore(updatedAt: Date, maxAgeDays = 180): number {
    const ageDays = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - ageDays / maxAgeDays);
}

export type DiscoverySignals = {
    popularityScore: number;
    freshnessScore: number;
    completenessScore: number;
    editorialScore: number;
    discoveryScore: number;
    horizonScore: number;
};

/** maxViewCountInPeerGroup = the highest viewCount among places in the same category — "popular" is relative to peers, not an absolute number. */
export async function computeDiscoverySignals(place: Place, maxViewCountInPeerGroup: number): Promise<DiscoverySignals> {
    const popularityScore = maxViewCountInPeerGroup > 0 ? Math.min(1, place.viewCount / maxViewCountInPeerGroup) : 0;
    const freshness = freshnessScore(place.updatedAt);
    const health = await computePlaceSeoHealth(place.id);
    const completenessScore = health.score / 100;
    const editorialScore = place.featured ? 1 : 0; // real, admin-controlled signal — never fabricated

    // Editorial is intentionally excluded from discoveryScore — it's a
    // separate axis (see the doc's own "Editor's Picks: Editorial + Quality"
    // example), not folded into general popularity/freshness/completeness.
    const discoveryScore = popularityScore * 0.4 + freshness * 0.3 + completenessScore * 0.3;
    const horizonScore = discoveryScore * 0.85 + editorialScore * 0.15;

    return { popularityScore, freshnessScore: freshness, completenessScore, editorialScore, discoveryScore, horizonScore };
}