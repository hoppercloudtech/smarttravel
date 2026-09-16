// lib/seo/experiments.ts
//
// Never declares a winner from a tiny sample, and never ignores a
// simultaneous position shift — both explicit Section 15 requirements.

import { prisma } from "@/lib/prisma";

const MIN_IMPRESSIONS_FOR_VERDICT = 1000;
const MAX_POSITION_DRIFT_TO_TRUST_RESULT = 1.5; // if avg position moved more than this, CTR change isn't attributable to the title/description change alone

export async function startExperiment(opts: { page: string; titleBefore: string; titleAfter: string; descriptionBefore?: string; descriptionAfter?: string }) {
    const before = await prisma.searchPerformanceRecord.aggregate({
        where: { page: opts.page },
        _sum: { impressions: true, clicks: true },
        _avg: { averagePosition: true, ctr: true },
    });

    return prisma.seoExperiment.create({
        data: {
            page: opts.page,
            titleBefore: opts.titleBefore,
            titleAfter: opts.titleAfter,
            descriptionBefore: opts.descriptionBefore,
            descriptionAfter: opts.descriptionAfter,
            impressionsBefore: before._sum.impressions ?? 0,
            clicksBefore: before._sum.clicks ?? 0,
            ctrBefore: before._avg.ctr ?? 0,
            positionBefore: before._avg.averagePosition ?? 0,
        },
    });
}

export async function evaluateExperiment(experimentId: string) {
    const experiment = await prisma.seoExperiment.findUniqueOrThrow({ where: { id: experimentId } });

    const after = await prisma.searchPerformanceRecord.aggregate({
        where: { page: experiment.page, date: { gt: experiment.startedAt } },
        _sum: { impressions: true, clicks: true },
        _avg: { averagePosition: true, ctr: true },
    });

    const impressionsAfter = after._sum.impressions ?? 0;
    if (impressionsAfter < MIN_IMPRESSIONS_FOR_VERDICT) {
        return prisma.seoExperiment.update({ where: { id: experimentId }, data: { status: "RUNNING" } }); // not enough data yet — no verdict
    }

    const positionDrift = Math.abs((after._avg.averagePosition ?? 0) - (experiment.positionBefore ?? 0));
    const ctrChange = (after._avg.ctr ?? 0) - (experiment.ctrBefore ?? 0);

    let verdict: string;
    let status: string;

    if (positionDrift > MAX_POSITION_DRIFT_TO_TRUST_RESULT) {
        verdict = `Ranking position shifted by ${positionDrift.toFixed(1)} during the test — CTR change can't be attributed to the title/description alone.`;
        status = "INCONCLUSIVE";
    } else {
        verdict =
            ctrChange > 0
                ? `CTR improved by ${(ctrChange * 100).toFixed(2)} percentage points, with stable ranking position.`
                : `No CTR improvement observed (${(ctrChange * 100).toFixed(2)} pp change), with stable ranking position.`;
        status = "COMPLETED";
    }

    return prisma.seoExperiment.update({
        where: { id: experimentId },
        data: {
            status,
            verdict,
            impressionsAfter,
            clicksAfter: after._sum.clicks ?? 0,
            ctrAfter: after._avg.ctr ?? 0,
            positionAfter: after._avg.averagePosition ?? 0,
            endedAt: new Date(),
        },
    });
}