// lib/youtubeIngestion.ts
//
// The "queue" is the database itself: every place carries its own video state
// (videoStatus, videoNextSearchAt, attempts, lock). A RUN is a tracked pass over
// the places that match a mode. Runs are processed in small chunks so they fit
// Vercel's serverless time limit: the admin page (or the cron) calls
// processRun() repeatedly until it reports done.

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { PlaceCategory, VideoIngestionRun } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";
import {
    SEARCH_COST,
    TARGET_VIDEOS,
    claimPlace,
    isFatalYouTubeError,
    markSearchFailed,
    quotaRemaining,
    releaseLock,
    searchAndSaveVideos,
    type SearchablePlace,
} from "@/lib/youtube";

export type VideoRunMode = "ALL" | "ZERO" | "MORE" | "RETRY_UNAVAILABLE" | "PENDING" | "SCHEDULED";
export const ADMIN_MODES: VideoRunMode[] = ["ALL", "ZERO", "MORE", "RETRY_UNAVAILABLE", "PENDING"];

export type RunSnapshot = {
    id: string;
    mode: string;
    status: string;
    totalQueued: number;
    processed: number;
    foundCount: number;
    videosAdded: number;
    unavailableCount: number;
    failedCount: number;
    stopReason: string | null;
    triggeredBy: string | null;
    startedAt: string;
    finishedAt: string | null;
};

const STALE_RUN_MS = 3 * 60 * 1000; // a RUNNING run with no heartbeat for this long is considered dead

export function toSnapshot(r: VideoIngestionRun): RunSnapshot {
    return {
        id: r.id,
        mode: r.mode,
        status: r.status,
        totalQueued: r.totalQueued,
        processed: r.processed,
        foundCount: r.foundCount,
        videosAdded: r.videosAdded,
        unavailableCount: r.unavailableCount,
        failedCount: r.failedCount,
        stopReason: r.stopReason,
        triggeredBy: r.triggeredBy,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
    };
}

// ---------------------------------------------------------------------------
// Which places does each mode target?  (video count comes from a LEFT JOIN, so
// places with ZERO videos are found too.)
// ---------------------------------------------------------------------------

function buildClauses(mode: VideoRunMode, runStartedAt: Date | null) {
    const now = new Date();
    const T = Prisma.raw(String(TARGET_VIDEOS));
    const Tminus1 = Prisma.raw(String(TARGET_VIDEOS - 1));

    const where: Prisma.Sql[] = [
        Prisma.sql`p.status = 'PUBLISHED'`,
        Prisma.sql`(p."videoLockedUntil" IS NULL OR p."videoLockedUntil" < ${now})`,
    ];
    // inside a run, skip places already attempted since the run started
    if (runStartedAt) where.push(Prisma.sql`(p."videoLastAttemptAt" IS NULL OR p."videoLastAttemptAt" < ${runStartedAt})`);

    let having: Prisma.Sql;
    switch (mode) {
        case "SCHEDULED": // what the daily cron works through, respecting every retry schedule
            where.push(Prisma.sql`(p."videoNextSearchAt" IS NULL OR p."videoNextSearchAt" <= ${now})`);
            having = Prisma.sql`(p."videoStatus" <> 'FOUND' OR COUNT(v.id) < ${T})`;
            break;
        case "ALL": // every place with fewer than the target (admin override of retry dates; NONE_FOUND has its own button)
            where.push(Prisma.sql`p."videoStatus" IN ('PENDING','FAILED','FOUND')`);
            having = Prisma.sql`COUNT(v.id) < ${T}`;
            break;
        case "ZERO":
            where.push(Prisma.sql`p."videoStatus" IN ('PENDING','FAILED','FOUND')`);
            having = Prisma.sql`COUNT(v.id) = 0`;
            break;
        case "MORE":
            where.push(Prisma.sql`p."videoStatus" IN ('PENDING','FAILED','FOUND')`);
            having = Prisma.sql`COUNT(v.id) BETWEEN 1 AND ${Tminus1}`;
            break;
        case "RETRY_UNAVAILABLE":
            where.push(Prisma.sql`p."videoStatus" = 'NONE_FOUND'`);
            having = Prisma.sql`COUNT(v.id) < ${T}`;
            break;
        case "PENDING":
            where.push(Prisma.sql`p."videoStatus" = 'PENDING'`);
            having = Prisma.sql`COUNT(v.id) < ${T}`;
            break;
    }
    return { where: Prisma.join(where, " AND "), having };
}

type PickRow = {
    id: string;
    name: string;
    slug: string;
    category: string;
    attempts: number;
    cityName: string | null;
    countryName: string;
    videoCount: number;
};

export async function pickPlaces(mode: VideoRunMode, opts: { limit: number; runStartedAt?: Date | null }): Promise<SearchablePlace[]> {
    const { where, having } = buildClauses(mode, opts.runStartedAt ?? null);
    const rows = await prisma.$queryRaw<PickRow[]>(Prisma.sql`
        SELECT p.id, p.name, p.slug, p.category::text AS category,
               p."videoSearchAttempts" AS attempts,
               c.name AS "cityName", co.name AS "countryName",
               COUNT(v.id)::int AS "videoCount"
        FROM places p
        JOIN countries co ON co.id = p."countryId"
        LEFT JOIN cities c ON c.id = p."cityId"
        LEFT JOIN place_videos v ON v."placeId" = p.id
        WHERE ${where}
        GROUP BY p.id, c.name, co.name
        HAVING ${having}
        ORDER BY p."viewCount" DESC, p."createdAt" ASC
        LIMIT ${opts.limit}
    `);
    return rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        category: r.category as PlaceCategory,
        attempts: r.attempts,
        cityName: r.cityName,
        countryName: r.countryName,
        videoCount: r.videoCount,
    }));
}

export async function countForMode(mode: VideoRunMode, runStartedAt: Date | null = null): Promise<number> {
    const { where, having } = buildClauses(mode, runStartedAt);
    const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
        SELECT COUNT(*)::int AS count FROM (
            SELECT p.id
            FROM places p
            LEFT JOIN place_videos v ON v."placeId" = p.id
            WHERE ${where}
            GROUP BY p.id
            HAVING ${having}
        ) q
    `);
    return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Dashboard statistics
// ---------------------------------------------------------------------------

export type VideoStats = {
    total: number;
    zero: number;
    one: number;
    two: number;
    threePlus: number;
    pending: number;
    found: number;
    unavailable: number;
    failed: number;
};

export async function getVideoStats(): Promise<VideoStats> {
    const rows = await prisma.$queryRaw<VideoStats[]>(Prisma.sql`
        WITH pc AS (
            SELECT p.id, p."videoStatus" AS vs, COUNT(v.id)::int AS cnt
            FROM places p
            LEFT JOIN place_videos v ON v."placeId" = p.id
            GROUP BY p.id
        )
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE cnt = 0)::int AS zero,
               COUNT(*) FILTER (WHERE cnt = 1)::int AS one,
               COUNT(*) FILTER (WHERE cnt = 2)::int AS two,
               COUNT(*) FILTER (WHERE cnt >= 3)::int AS "threePlus",
               COUNT(*) FILTER (WHERE vs = 'PENDING')::int AS pending,
               COUNT(*) FILTER (WHERE vs = 'FOUND')::int AS found,
               COUNT(*) FILTER (WHERE vs = 'NONE_FOUND')::int AS unavailable,
               COUNT(*) FILTER (WHERE vs = 'FAILED')::int AS failed
        FROM pc
    `);
    return rows[0] ?? { total: 0, zero: 0, one: 0, two: 0, threePlus: 0, pending: 0, found: 0, unavailable: 0, failed: 0 };
}

// ---------------------------------------------------------------------------
// Runs: start (only one active at a time), process in chunks, finish
// ---------------------------------------------------------------------------

export async function getActiveRun(): Promise<RunSnapshot | null> {
    const run = await prisma.videoIngestionRun.findFirst({
        where: { status: "RUNNING", heartbeatAt: { gt: new Date(Date.now() - STALE_RUN_MS) } },
        orderBy: { startedAt: "desc" },
    });
    return run ? toSnapshot(run) : null;
}

export type StartResult =
    | { ok: true; run: RunSnapshot }
    | { ok: false; reason: "already_running"; run: RunSnapshot | null }
    | { ok: false; reason: "nothing_to_do" };

export async function startRun(mode: VideoRunMode, triggeredBy: "admin" | "cron"): Promise<StartResult> {
    // a run that stopped sending heartbeats (crashed / tab closed long ago) no longer blocks new runs
    await prisma.videoIngestionRun.updateMany({
        where: { status: "RUNNING", heartbeatAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
        data: { status: "STOPPED", stopReason: "Stopped automatically: no activity for several minutes", finishedAt: new Date(), activeKey: null },
    });

    const total = await countForMode(mode);
    if (total === 0) return { ok: false, reason: "nothing_to_do" };

    try {
        const run = await prisma.videoIngestionRun.create({
            data: { mode, status: "RUNNING", activeKey: "active", totalQueued: total, triggeredBy },
        });
        return { ok: true, run: toSnapshot(run) };
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            return { ok: false, reason: "already_running", run: await getActiveRun() };
        }
        throw err;
    }
}

export async function finishRun(runId: string, status: "COMPLETED" | "STOPPED" | "FAILED", reason: string | null): Promise<RunSnapshot> {
    await prisma.videoIngestionRun.updateMany({
        where: { id: runId, status: "RUNNING" },
        data: { status, stopReason: reason, finishedAt: new Date(), activeKey: null },
    });
    return toSnapshot(await prisma.videoIngestionRun.findUniqueOrThrow({ where: { id: runId } }));
}

export async function stopRun(runId: string) {
    return finishRun(runId, "STOPPED", "Stopped by admin");
}

function revalidatePlacePage(category: PlaceCategory, slug: string) {
    try {
        revalidatePath(`/${CATEGORY_CONFIG[category].slug}/${slug}`);
    } catch {
        /* the page refreshes on its normal 24h cycle anyway */
    }
}

/**
 * Processes places for a run until maxPlaces or the time budget is reached.
 * Never lets one place's error stop the others; stops the whole run only for
 * quota/key problems or when the daily budget is used up.
 */
export async function processRun(
    runId: string,
    opts: { maxPlaces: number; budgetMs: number }
): Promise<{ done: boolean; run: RunSnapshot }> {
    const run = await prisma.videoIngestionRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error("Run not found.");
    if (run.status !== "RUNNING") return { done: true, run: toSnapshot(run) };

    const started = Date.now();
    let finalStatus: "COMPLETED" | "STOPPED" | null = null;
    let stopReason: string | null = null;

    for (let i = 0; i < opts.maxPlaces; i++) {
        if (Date.now() - started > opts.budgetMs) break;

        if ((await quotaRemaining()) < SEARCH_COST) {
            finalStatus = "STOPPED";
            stopReason = "Daily YouTube quota budget reached. Run it again tomorrow (the quota resets at midnight Pacific time).";
            break;
        }

        const [place] = await pickPlaces(run.mode as VideoRunMode, { limit: 1, runStartedAt: run.startedAt });
        if (!place) {
            finalStatus = "COMPLETED";
            break;
        }
        if (!(await claimPlace(place.id))) continue; // another worker has it; the next pick skips locked places

        let found = 0, added = 0, unavailable = 0, failed = 0;
        try {
            const out = await searchAndSaveVideos(place);
            if (out.added > 0) {
                found = 1;
                added = out.added;
                revalidatePlacePage(place.category, place.slug);
            }
            if (out.status === "NONE_FOUND") unavailable = 1;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "unknown error";
            console.error(`[YouTube] ${place.name}:`, msg);
            if (isFatalYouTubeError(err)) {
                await releaseLock(place.id);
                finalStatus = "STOPPED";
                stopReason = `YouTube API problem (check the key and quota): ${msg.slice(0, 300)}`;
                break;
            }
            failed = 1;
            await markSearchFailed(place.id, place.videoCount);
        }

        await prisma.videoIngestionRun.update({
            where: { id: runId },
            data: {
                processed: { increment: 1 },
                foundCount: { increment: found },
                videosAdded: { increment: added },
                unavailableCount: { increment: unavailable },
                failedCount: { increment: failed },
                heartbeatAt: new Date(),
            },
        });
    }

    if (finalStatus) return { done: true, run: await finishRun(runId, finalStatus, stopReason) };

    const updated = await prisma.videoIngestionRun.update({ where: { id: runId }, data: { heartbeatAt: new Date() } });
    return { done: false, run: toSnapshot(updated) };
}

// ---------------------------------------------------------------------------
// Retry ONE place immediately (per-row button in the admin table)
// ---------------------------------------------------------------------------

export async function retryPlace(placeId: string): Promise<{ ok: boolean; message: string }> {
    const row = await prisma.place.findUnique({
        where: { id: placeId },
        select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            videoSearchAttempts: true,
            city: { select: { name: true } },
            country: { select: { name: true } },
            _count: { select: { videos: true } },
        },
    });
    if (!row) return { ok: false, message: "Place not found." };
    if (row._count.videos >= TARGET_VIDEOS) return { ok: true, message: `Already has ${row._count.videos} videos, nothing to search.` };
    if ((await quotaRemaining()) < SEARCH_COST) {
        return { ok: false, message: "Daily YouTube quota budget reached. Try again tomorrow (resets at midnight Pacific time)." };
    }
    if (!(await claimPlace(row.id))) return { ok: false, message: "This place is being processed right now. Try again in a minute." };

    const place: SearchablePlace = {
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category,
        cityName: row.city?.name ?? null,
        countryName: row.country.name,
        videoCount: row._count.videos,
        attempts: row.videoSearchAttempts,
    };

    try {
        const out = await searchAndSaveVideos(place);
        if (out.added > 0) {
            revalidatePlacePage(place.category, place.slug);
            return { ok: true, message: `Added ${out.added} video${out.added === 1 ? "" : "s"} (${out.total} total).` };
        }
        if (out.status === "NONE_FOUND") return { ok: true, message: "No relevant videos found. Marked unavailable; it will be retried automatically later." };
        if (out.status === "PENDING") return { ok: true, message: "No relevant videos found yet. A second search with a wider query is scheduled." };
        return { ok: true, message: `No new relevant videos found; the place keeps its ${out.total}.` };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown error";
        console.error(`[YouTube] retry ${place.name}:`, msg);
        if (isFatalYouTubeError(err)) {
            await releaseLock(place.id);
            return { ok: false, message: `YouTube API problem (check the key and quota): ${msg.slice(0, 200)}` };
        }
        await markSearchFailed(place.id, place.videoCount);
        return { ok: false, message: "The search failed (network or YouTube error). It will be retried automatically later." };
    }
}