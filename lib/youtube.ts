// lib/youtube.ts
//
// Server-only YouTube Data API v3 client + persistent discovery state.
//
// Cost rules:
//  - Pages NEVER call YouTube. They only read saved rows.
//  - search.list (100 units) runs only from the cron, in small batches, and only
//    for places whose videoStatus is PENDING / NONE_FOUND / FAILED and whose
//    videoNextSearchAt has passed.
//  - Saved videos are re-checked with videos.list (1 unit for up to 50 videos)
//    every VERIFY_EVERY_DAYS (< 30, to respect YouTube's data-refresh rule).
//    Deleted/private/non-embeddable videos are dropped; the next saved video is
//    promoted, and only if none remain does the place go back to PENDING.

import type { PlaceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const API = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = Math.max(1, Math.min(10, Number(process.env.YOUTUBE_MAX_VIDEOS ?? 6)));
const RETRY_NONE_FOUND_DAYS = Number(process.env.YOUTUBE_RETRY_NONE_DAYS ?? 60);
const RETRY_FAILED_HOURS = Number(process.env.YOUTUBE_RETRY_FAILED_HOURS ?? 24);
const VERIFY_EVERY_DAYS = Number(process.env.YOUTUBE_VERIFY_DAYS ?? 25);
const VERIFY_PLACES_PER_CALL = Math.max(1, Math.floor(50 / MAX_VIDEOS)); // videos.list takes at most 50 ids
const MAX_VERIFY_CALLS = 5; // at most 5 quota units per run

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

async function apiGet<T>(path: string, params: Record<string, string>): Promise<T> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new YouTubeApiError(0, "YOUTUBE_API_KEY is not set.");
    const res = await fetch(`${API}${path}?${new URLSearchParams({ ...params, key })}`, { cache: "no-store" });
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

export type SearchablePlace = { id: string; name: string; cityName: string | null; countryName: string };

/**
 * ONE search (100 units) for ONE place; saves the result and its status.
 * Throws on API failure without changing anything, so a quota error is never
 * recorded as "no video exists".
 */
export async function searchAndSaveVideos(place: SearchablePlace): Promise<number> {
    const data = await apiGet<{ items?: SearchItem[] }>("/search", {
        part: "snippet",
        type: "video",
        q: `${place.name} ${place.cityName ?? place.countryName}`,
        maxResults: "30", // same 100-unit cost as 5; over-fetch because many are filtered out as unrelated
        videoEmbeddable: "true",
        safeSearch: "strict",
        relevanceLanguage: "en",
    });

    const seen = new Set<string>();
    const picked = (data.items ?? [])
        .filter((i) => i.id.videoId && !seen.has(i.id.videoId) && seen.add(i.id.videoId))
        .map((item) => ({ item, score: scoreItem(item, place.name, place.cityName) }))
        .filter((x): x is { item: SearchItem; score: number } => x.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_VIDEOS)
        .map((x) => x.item);

    const now = new Date();
    await prisma.$transaction([
        prisma.placeVideo.deleteMany({ where: { placeId: place.id } }),
        prisma.placeVideo.createMany({
            data: picked.map((i, idx) => ({
                placeId: place.id,
                videoId: i.id.videoId as string,
                title: decodeEntities(i.snippet.title),
                channelTitle: i.snippet.channelTitle ? decodeEntities(i.snippet.channelTitle) : null,
                thumbnailUrl: pickThumb(i.snippet.thumbnails, i.id.videoId),
                order: idx,
            })),
        }),
        prisma.place.update({
            where: { id: place.id },
            data: {
                videosCheckedAt: now,
                videoStatus: picked.length > 0 ? "FOUND" : "NONE_FOUND",
                videoNextSearchAt: picked.length > 0 ? null : addDays(now, RETRY_NONE_FOUND_DAYS),
                videoVerifiedAt: picked.length > 0 ? now : null,
            },
        }),
    ]);

    return picked.length;
}

/** A non-fatal failure (network/5xx): retry this place later, don't hammer it. */
export async function markSearchFailed(placeId: string) {
    await prisma.place.update({
        where: { id: placeId },
        data: { videoStatus: "FAILED", videoNextSearchAt: addHours(new Date(), RETRY_FAILED_HOURS) },
    });
}

/** Places that need a search, most-viewed first. */
export async function pickPlacesForSearch(limit: number) {
    const rows = await prisma.place.findMany({
        where: {
            status: "PUBLISHED",
            videoStatus: { in: ["PENDING", "NONE_FOUND", "FAILED"] },
            OR: [{ videoNextSearchAt: null }, { videoNextSearchAt: { lte: new Date() } }],
        },
        orderBy: [{ viewCount: "desc" }, { createdAt: "asc" }],
        take: limit,
        select: {
            id: true,
            name: true,
            slug: true,
            category: true,
            city: { select: { name: true } },
            country: { select: { name: true } },
        },
    });
    return rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        category: r.category,
        cityName: r.city?.name ?? null,
        countryName: r.country.name,
    }));
}

/**
 * Availability + metadata refresh for saved videos: one videos.list call
 * (1 unit) per batch of places, at most MAX_VERIFY_CALLS per run. Removes videos
 * that are deleted, private or no longer embeddable, and refreshes titles and
 * thumbnails of the rest.
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
            const data = await apiGet<{ items?: VideoItem[] }>("/videos", { part: "snippet,status", id: ids.join(","), maxResults: "50" });
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
                            ? { videoStatus: "PENDING", videoNextSearchAt: null, videoVerifiedAt: null } // search again
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