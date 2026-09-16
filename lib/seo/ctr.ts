// lib/seo/ctr.ts
//
// Implements Section 13's explicit distinction: low CTR alone doesn't mean
// "bad title" — position matters. These thresholds are simple and
// documented, not hidden magic numbers.

import { prisma } from "@/lib/prisma";
import type { CtrOpportunityCategory } from "@prisma/client";

const LOW_CTR_THRESHOLD = 0.02; // 2%
const HIGH_CTR_THRESHOLD = 0.08; // 8%
const GOOD_POSITION_THRESHOLD = 10;
const MIN_IMPRESSIONS_TO_CONSIDER = 500; // avoid acting on noise

export async function detectCtrOpportunities() {
    const aggregates = await prisma.searchPerformanceRecord.groupBy({
        by: ["page", "query"],
        _sum: { impressions: true, clicks: true },
        _avg: { averagePosition: true },
    });

    let detected = 0;

    for (const agg of aggregates) {
        const impressions = agg._sum.impressions ?? 0;
        const clicks = agg._sum.clicks ?? 0;
        const position = agg._avg.averagePosition ?? 999;
        if (impressions < MIN_IMPRESSIONS_TO_CONSIDER) continue;

        const ctr = impressions > 0 ? clicks / impressions : 0;
        let category: CtrOpportunityCategory | null = null;

        if (clicks === 0 && impressions > MIN_IMPRESSIONS_TO_CONSIDER * 2) {
            category = "QUERY_MISMATCH";
        } else if (ctr < LOW_CTR_THRESHOLD && position <= GOOD_POSITION_THRESHOLD) {
            category = "SNIPPET_PROBLEM";
        } else if (ctr < LOW_CTR_THRESHOLD && position > GOOD_POSITION_THRESHOLD) {
            category = "RANKING_PROBLEM";
        } else if (ctr > HIGH_CTR_THRESHOLD && position > GOOD_POSITION_THRESHOLD) {
            category = "RANKING_OPPORTUNITY";
        }

        if (category) {
            await prisma.ctrOpportunity.create({
                data: { page: agg.page, query: agg.query, impressions, clicks, ctr, averagePosition: position, category },
            });
            detected++;
        }
    }

    console.log(`[SEO] Detected ${detected} CTR opportunities.`);
    return { detected };
}