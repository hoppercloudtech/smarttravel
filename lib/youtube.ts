// lib/youtube.ts
//
// Server-only YouTube Data API v3 client + discovery rules.
//
// Rules (see also lib/youtubeIngestion.ts for the queue/run side):
//  - Pages NEVER call YouTube; they only read saved rows.
//  - A search TOPS UP a place to TARGET_VIDEOS. It never deletes valid videos and
//    never saves the same YouTube video twice.
//  - 0 videos found: first miss -> retry in a week with a wider query; second miss
//    -> NONE_FOUND, retried every 30 days.
//  - 1..TARGET-1 videos after a search: keep them, try for more after 30 days.
//  - Technical failures (network/5xx): FAILED with exponential backoff, capped at 7 days.
//  - Quota/key problems (400/401/403/429) are "fatal": the caller stops the whole run.
//  - Every API call is counted against a per-day budget stored in the database.

import type { Prisma, PlaceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";

const API = "https://www.googleapis.com/youtube/v3";

export const TARGET_VIDEOS = Math.max(1, Math.min(10, Number(process.env.YOUTUBE_MAX_VIDEOS ?? 3)));
export const SEARCH_COST = 100;
const VERIFY_COST = 1;
export const DAILY_QUOTA_BUDGET = Number(process.env.YOUTUBE_DAILY_QUOTA ?? 9000); // free quota is 10,000; keep a margin

const MISSES_BEFORE_NOT_FOUND = Number(process.env.YOUTUBE_MISSES_BEFORE_NOT_FOUND ?? 2);
const FIRST_MISS_RETRY_DAYS = Number(process.env.YOUTUBE_FIRST_MISS_RETRY_DAYS ?? 7);
const NOT_FOUND_RETRY_DAYS = Number(process.env.YOUTUBE_RETRY_NONE_DAYS ?? 30);
const TOPUP_RETRY_DAYS = Number(process.env.YOUTUBE_TOPUP_RETRY_DAYS ?? 30);
const MAX_BACKOFF_HOURS = 168; // 7 days
const VERIFY_EVERY_DAYS = Number(process.env.YOUTUBE_VERIFY_DAYS ?? 25); // < 30: YouTube's data-refresh rule
const VERIFY_PLACES_PER_CALL = Math.max(1, Math.floor(50 / TARGET_VIDEOS)); // videos.list takes at most 50 ids
const MAX_VERIFY_CALLS = 5;
const LOCK_MINUTES = 5;

export class YouTubeApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

/** Config/quota problems: stop the whole run instead of burning more calls. */
export function isFatalYouTubeError(err: unknown): boolean {
    return err instanceof YouTubeApiError && [0, 400, 401, 403, 429].includes(err.status);
}

type Thumbs = { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
type SearchItem = {
    id: { videoId?: string };
    snippet: { title: string; channelTitle: string; thumbnails?: Thumbs };
};
type VideoItem = {
    id: string;
    snippet?: { title: string; channelTitle: string; thumbnails?: Thumbs };
    status?: { privacyStatus?: string; embeddable?: boolean };
};

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const addHours = (d: Date, n: number) => new Date(d.getTime() + n * 3_600_000);
const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60_000);

// ---------------------------------------------------------------------------
// Quota budget (YouTube resets its daily quota at midnight Pacific time)
// ---------------------------------------------------------------------------

export function quotaDayKey(d: Date = new Date()): string {
    return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // YYYY-MM-DD
}

export async function quotaUsedToday(): Promise<number> {
    const row = await prisma.youtubeQuotaDay.findUnique({ where: { day: quotaDayKey() } });
    return row?.unitsUsed ?? 0;
}

export async function quotaRemaining(): Promise<number> {
    return Math.max(0, DAILY_QUOTA_BUDGET - (await quotaUsedToday()));
}

async function recordQuota(units: number) {
    try {
        const day = quotaDayKey();
        await prisma.youtubeQuotaDay.upsert({
            where: { day },
            update: { unitsUsed: { increment: units } },
            create: { day, unitsUsed: units },
        });
    } catch (err) {
        console.error("[YouTube] could not record quota usage:", err instanceof Error ? err.message : "unknown error");
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function normalize(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function pickThumb(t?: Thumbs, videoId?: string): string {
    return t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function apiGet<T>(path: string, params: Record<string, string>, cost: number): Promise<T> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new YouTubeApiError(0, "YOUTUBE_API_KEY is not set.");
    const res = await fetch(`${API}${path}?${new URLSearchParams({ ...params, key })}`, { cache: "no-store" });
    await recordQuota(cost); // a request that reached YouTube costs quota even when it returns an error
    if (!res.ok) throw new YouTubeApiError(res.status, `YouTube API error (${res.status}): ${await res.text()}`);
    return (await res.json()) as T;
}

/**
 * Relevance score, or null when the video must NOT be associated with the place.
 * The place name must appear in the video title or channel name (exact phrase, or
 * every word of a multi-word name). Short/generic names ("Garden Hotel") must also
 * match the city. Higher score = better match.
 */
function scoreItem(item: SearchItem, placeName: string, cityName: string | null): number | null {
    const title = normalize(item.snippet.title);
    const hay = `${title} ${normalize(item.snippet.channelTitle)}`;
    const name = normalize(placeName);
    if (!name) return null;

    const tokens = name.split(" ");
    const words = new Set(hay.split(" "));
    const exact = hay.includes(name);
    const allWords = tokens.length >= 2 && tokens.every((t) => words.has(t));
    if (!exact && !allWords) return null;

    const city = cityName ? normalize(cityName) : "";
    const cityHit = city !== "" && hay.includes(city);
    if (tokens.length <= 2 && city !== "" && !cityHit) return null;

    let score = title.includes(name) ? 3 : exact ? 2 : 1;
    if (cityHit) score += 2;
    if (/\b(hotel|resort|lodge|inn|guest ?house|apartment|camp|restaurant|tour|review|room|stay|walkthrough|vlog|visit)\b/.test(title)) score += 1;
    return score;
}

export type SearchablePlace = {
    id: string;
    name: string;
    slug: string;
    category: PlaceCategory;
    cityName: string | null;
    countryName: string;
    videoCount: number; // videos already saved
    attempts: number; // consecutive searches that found nothing
};

export type SearchOutcome = { added: number; total: number; status: "FOUND" | "PENDING" | "NONE_FOUND" };

/** First search: name + city. Later searches add the category word and country for a different angle. */
function buildQuery(place: SearchablePlace): string {
    const label = CATEGORY_CONFIG[place.category].label.toLowerCase();
    const parts =
        place.attempts === 0
            ? [place.name, place.cityName ?? place.countryName]
            : [place.name, label, place.cityName, place.countryName];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
        if (!p) continue;
        const k = p.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(p);
    }
    return out.join(" ");
}

// ---------------------------------------------------------------------------
// Locking + failure handling
// ---------------------------------------------------------------------------

/** Atomically claims a place; false means another worker already holds it. */
export async function claimPlace(placeId: string): Promise<boolean> {
    const now = new Date();
    const res = await prisma.place.updateMany({
        where: { id: placeId, OR: [{ videoLockedUntil: null }, { videoLockedUntil: { lt: now } }] },
        data: { videoLockedUntil: addMinutes(now, LOCK_MINUTES) },
    });
    return res.count === 1;
}

export async function releaseLock(placeId: string) {
    await prisma.place.update({ where: { id: placeId }, data: { videoLockedUntil: null } }).catch(() => { });
}

/** Non-fatal failure (network/5xx): exponential backoff 2h, 4h, 8h ... capped at 7 days. */
export async function markSearchFailed(placeId: string, videoCount: number) {
    const current = await prisma.place.findUnique({ where: { id: placeId }, select: { videoFailCount: true } });
    const failCount = (current?.videoFailCount ?? 0) + 1;
    const now = new Date();
    await prisma.place.update({
        where: { id: placeId },
        data: {
            videoFailCount: failCount,
            videoLastAttemptAt: now,
            videoLockedUntil: null,
            videoNextSearchAt: addHours(now, Math.min(MAX_BACKOFF_HOURS, 2 ** failCount)),
            // a place that already has videos keeps its FOUND status; only empty places show as FAILED
            ...(videoCount === 0 ? { videoStatus: "FAILED" as const } : {}),
        },
    });
}

// ---------------------------------------------------------------------------
// Search (100 units) + save
// ---------------------------------------------------------------------------

/**
 * ONE search for ONE place; appends new relevant videos up to TARGET_VIDEOS and
 * records the outcome. Throws on API failure; the caller releases the lock and
 * calls markSearchFailed (or stops the run when the error is fatal).
 */
export async function searchAndSaveVideos(place: SearchablePlace): Promise<SearchOutcome> {
    const now = new Date();
    const need = TARGET_VIDEOS - place.videoCount;

    if (need <= 0) {
        await prisma.place.update({
            where: { id: place.id },
            data: {
                videoStatus: "FOUND",
                videoNextSearchAt: null,
                videoSearchAttempts: 0,
                videoFailCount: 0,
                videoLastAttemptAt: now,
                videoLockedUntil: null,
            },
        });
        return { added: 0, total: place.videoCount, status: "FOUND" };
    }

    const data = await apiGet<{ items?: SearchItem[] }>(
        "/search",
        {
            part: "snippet",
            type: "video",
            q: buildQuery(place),
            maxResults: "30", // same 100-unit cost as 5; over-fetch because many are filtered out as unrelated
            videoEmbeddable: "true",
            safeSearch: "strict",
            relevanceLanguage: "en",
        },
        SEARCH_COST
    );

    const existing = await prisma.placeVideo.findMany({ where: { placeId: place.id }, select: { videoId: true, order: true } });
    const existingIds = new Set(existing.map((e) => e.videoId));
    const nextOrder = existing.length ? Math.max(...existing.map((e) => e.order)) + 1 : 0;

    const seen = new Set<string>();
    const picked = (data.items ?? [])
        .filter((i) => i.id.videoId && !existingIds.has(i.id.videoId) && !seen.has(i.id.videoId) && seen.add(i.id.videoId))
        .map((item) => ({ item, score: scoreItem(item, place.name, place.cityName) }))
        .filter((x): x is { item: SearchItem; score: number } => x.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, need)
        .map((x) => x.item);

    const total = existing.length + picked.length;

    const base = { videosCheckedAt: now, videoLastAttemptAt: now, videoFailCount: 0, videoLockedUntil: null };
    let update: Prisma.PlaceUpdateInput;
    let status: SearchOutcome["status"];

    if (total >= TARGET_VIDEOS) {
        status = "FOUND";
        update = { ...base, videoStatus: "FOUND", videoNextSearchAt: null, videoSearchAttempts: 0 };
    } else if (total > 0) {
        status = "FOUND";
        update = { ...base, videoStatus: "FOUND", videoNextSearchAt: addDays(now, TOPUP_RETRY_DAYS), videoSearchAttempts: 0 };
    } else {
        const attempts = place.attempts + 1;
        const notFound = attempts >= MISSES_BEFORE_NOT_FOUND;
        status = notFound ? "NONE_FOUND" : "PENDING";
        update = {
            ...base,
            videoStatus: status,
            videoSearchAttempts: attempts,
            videoNextSearchAt: addDays(now, notFound ? NOT_FOUND_RETRY_DAYS : FIRST_MISS_RETRY_DAYS),
            videoVerifiedAt: null,
        };
    }
    if (existing.length === 0 && picked.length > 0) update.videoVerifiedAt = now; // all-fresh metadata

    const ops = [
        ...(picked.length > 0
            ? [
                prisma.placeVideo.createMany({
                    data: picked.map((i, idx) => ({
                        placeId: place.id,
                        videoId: i.id.videoId as string,
                        title: decodeEntities(i.snippet.title),
                        channelTitle: i.snippet.channelTitle ? decodeEntities(i.snippet.channelTitle) : null,
                        thumbnailUrl: pickThumb(i.snippet.thumbnails, i.id.videoId),
                        order: nextOrder + idx,
                    })),
                    skipDuplicates: true,
                }),
            ]
            : []),
        prisma.place.update({ where: { id: place.id }, data: update }),
    ];
    await prisma.$transaction(ops);

    return { added: picked.length, total, status };
}

// ---------------------------------------------------------------------------
// Availability + metadata refresh of saved videos (1 unit per call)
// ---------------------------------------------------------------------------

/**
 * Removes videos that are deleted, private or no longer embeddable, and refreshes
 * titles/thumbnails of the rest. A place whose videos are ALL gone goes back to
 * PENDING so it is searched again.
 */
export async function verifyDueVideos(): Promise<{
    checked: number;
    removed: number;
    touched: { slug: string; category: PlaceCategory }[];
}> {
    let checked = 0;
    let removed = 0;
    const touched: { slug: string; category: PlaceCategory }[] = [];

    for (let round = 0; round < MAX_VERIFY_CALLS; round++) {
        const cutoff = addDays(new Date(), -VERIFY_EVERY_DAYS);
        const places = await prisma.place.findMany({
            where: { videoStatus: "FOUND", OR: [{ videoVerifiedAt: null }, { videoVerifiedAt: { lt: cutoff } }] },
            orderBy: [{ videoVerifiedAt: { sort: "asc", nulls: "first" } }],
            take: VERIFY_PLACES_PER_CALL,
            select: { id: true, slug: true, category: true, videos: { orderBy: { order: "asc" }, select: { id: true, videoId: true } } },
        });
        if (places.length === 0) break;

        const ids = Array.from(new Set(places.flatMap((p) => p.videos.map((v) => v.videoId))));
        const byId = new Map<string, VideoItem>();
        if (ids.length > 0) {
            const data = await apiGet<{ items?: VideoItem[] }>("/videos", { part: "snippet,status", id: ids.join(","), maxResults: "50" }, VERIFY_COST);
            for (const it of data.items ?? []) byId.set(it.id, it);
        }

        const now = new Date();
        for (const p of places) {
            const keep: { rowId: string; item: VideoItem }[] = [];
            const drop: string[] = [];
            for (const v of p.videos) {
                const item = byId.get(v.videoId);
                const ok = !!item && item.status?.privacyStatus === "public" && item.status?.embeddable !== false && !!item.snippet;
                if (ok) keep.push({ rowId: v.id, item: item as VideoItem });
                else drop.push(v.id);
            }

            const ops = [
                ...(drop.length ? [prisma.placeVideo.deleteMany({ where: { id: { in: drop } } })] : []),
                ...keep.map((k, idx) =>
                    prisma.placeVideo.update({
                        where: { id: k.rowId },
                        data: {
                            order: idx, // a spare is promoted to the main video when the main one is removed
                            title: decodeEntities(k.item.snippet!.title),
                            channelTitle: k.item.snippet!.channelTitle ? decodeEntities(k.item.snippet!.channelTitle) : null,
                            thumbnailUrl: pickThumb(k.item.snippet!.thumbnails, k.item.id),
                            fetchedAt: now,
                        },
                    })
                ),
                prisma.place.update({
                    where: { id: p.id },
                    data:
                        keep.length === 0
                            ? { videoStatus: "PENDING", videoNextSearchAt: null, videoVerifiedAt: null, videoSearchAttempts: 0 }
                            : { videoVerifiedAt: now },
                }),
            ];
            await prisma.$transaction(ops);

            removed += drop.length;
            if (drop.length > 0) touched.push({ slug: p.slug, category: p.category });
        }
        checked += places.length;
    }

    return { checked, removed, touched };
}