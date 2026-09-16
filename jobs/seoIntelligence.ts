// jobs/seoIntelligence.ts
//
// Batch recompute — never calculated live per-request (Section 27).
// Health checks process oldest-checked-first each run (Place.lastSeoHealthCheckedAt),
// so repeated runs eventually cover every place without ever scanning
// everything in one pass — the same "continues from where it stopped"
// pattern as the existing ingestion crons.

import { prisma } from "@/lib/prisma";
import { evaluateLocationCategoryOpportunities } from "@/lib/seo/opportunity";
import { computePlaceSeoHealth } from "@/lib/seo/health";

const HEALTH_BATCH_SIZE = 200;

export async function recomputeSeoOpportunities() {
    const opportunities = await evaluateLocationCategoryOpportunities();

    await prisma.$transaction([
        prisma.seoInsight.deleteMany({ where: { kind: "OPPORTUNITY" } }),
        prisma.seoInsight.createMany({
            data: opportunities.map((o) => ({
                kind: "OPPORTUNITY" as const,
                countryId: o.countryId,
                cityId: o.cityId,
                category: o.category,
                placeCount: o.placeCount,
                recommendation: o.recommendation,
                score: o.qualityScore,
            })),
        }),
    ]);

    console.log(`[SEO] Recomputed ${opportunities.length} location/category opportunities.`);
    return { count: opportunities.length };
}

export async function recomputeSeoHealthBatch() {
    const places = await prisma.place.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ lastSeoHealthCheckedAt: { sort: "asc", nulls: "first" } }],
        take: HEALTH_BATCH_SIZE,
        select: { id: true },
    });

    let checked = 0;
    for (const { id } of places) {
        const health = await computePlaceSeoHealth(id);
        await prisma.$transaction([
            prisma.seoInsight.deleteMany({ where: { kind: "HEALTH_CHECK", placeId: id } }),
            prisma.seoInsight.create({ data: { kind: "HEALTH_CHECK", placeId: id, checks: health.checks, score: health.score } }),
            prisma.place.update({ where: { id }, data: { lastSeoHealthCheckedAt: new Date() } }),
        ]);
        checked++;
    }

    console.log(`[SEO] Checked SEO health for ${checked} places.`);
    return { checked };
}