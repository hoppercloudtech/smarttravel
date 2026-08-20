import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDailyQueue } from "@/lib/tiktok/queueBuilder";
import { attemptPublish, pollInFlightPublishes } from "@/lib/tiktok/publisher";

// This endpoint is meant to be hit every 5-15 minutes by an external
// scheduler, NOT relied on for its own timing. Reasons:
//
// 1. Vercel Cron's free/Hobby tier caps you at daily-granularity triggers,
//    which can't produce "5 posts spread across the day" on its own.
// 2. Even on Pro (which allows more frequent crons), a single daily-queue
//    build should run once, but PUBLISHING posts and due SCHEDULED posts
//    need checking far more often than once a day.
//
// Recommended setup: keep Vercel Cron for the ingestion pipeline as-is, and
// point a free external scheduler (cron-job.org, or Upstash QStash if you
// want retries/observability built in) at this URL every 10 minutes with
// the same bearer token used below.
//
// Each tick does three idempotent things, safe to run as often as you like:
//   1. Build today's queue for every connected account (no-ops if already built)
//   2. Poll any post stuck in PUBLISHING and finalize its status
//   3. Publish anything SCHEDULED and due, for accounts with autoPublish=true
export async function POST(req: NextRequest) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await prisma.tikTokAccount.findMany({
        where: { status: "ACTIVE" },
        include: { settings: true },
    });

    const queueResults = [];
    for (const account of accounts) {
        if (!account.settings) continue; // not configured yet — skip silently, settings page will prompt
        try {
            const result = await buildDailyQueue(account.id);
            queueResults.push({ accountId: account.id, ...result });
        } catch (err) {
            queueResults.push({ accountId: account.id, skipped: true, error: err instanceof Error ? err.message : String(err) });
        }
    }

    const pollResult = await pollInFlightPublishes();

    // Publish anything due, capped per tick so one slow TikTok response can't
    // stall a huge batch inside a single serverless invocation.
    const MAX_PUBLISHES_PER_TICK = 5;
    const publishedThisTick: string[] = [];

    for (const account of accounts) {
        if (!account.settings?.autoPublish) continue;

        const due = await prisma.tikTokPost.findMany({
            where: { accountId: account.id, status: "SCHEDULED", scheduledFor: { lte: new Date() } },
            orderBy: { scheduledFor: "asc" },
            take: MAX_PUBLISHES_PER_TICK - publishedThisTick.length,
        });

        for (const post of due) {
            if (publishedThisTick.length >= MAX_PUBLISHES_PER_TICK) break;
            await attemptPublish(post.id);
            publishedThisTick.push(post.id);
        }
    }

    return NextResponse.json({
        queueResults,
        pollResult,
        publishedThisTick: publishedThisTick.length,
    });
}

export async function GET(req: NextRequest) {
    return POST(req);
}