// lib/youtube.ts
//
// Server-only YouTube Data API v3 client + DB cache.
//
// Quota: search.list costs 100 units; the free quota is 10,000/day (~100
// searches). So we NEVER search per page view. Results (including "no videos
// found") are cached on the place for CACHE_DAYS, and the page only searches
// when the cache is missing/stale. A cron backfills in small batches.

import { prisma } from "@/lib/prisma";

const CACHE_DAYS = Number(process.env.YOUTUBE_CACHE_DAYS ?? 30);
const MAX_VIDEOS = 8;

export type PlaceVideoCard = {
    videoId: string;
    title: string;
    channelTitle: string | null;
    thumbnailUrl: string;
};

type YouTubeSearchItem = {
    id: { videoId?: string };
    snippet: {
        title: string;
        channelTitle: string;
        thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
    };
};

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

/**
 * Guards against videos about a different hotel: the normalized place name
 * must appear in the video title or channel name. Short/generic names
 * ("Garden Hotel", "K Hotel") are the riskiest, so they also need the city.
 */
function isRelevant(item: YouTubeSearchItem, placeName: string, cityName: string | null): boolean {
    const hay = normalize(`${item.snippet.title} ${item.snippet.channelTitle}`);
    const name = normalize(placeName);
    if (!name || !hay.includes(name)) return false;
    const generic = name.split(" ").length <= 2;
    if (generic && cityName) return hay.includes(normalize(cityName));
    return true;
}

async function searchYouTube(query: string): Promise<YouTubeSearchItem[]> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new Error("YOUTUBE_API_KEY is not set.");

    const params = new URLSearchParams({
        part: "snippet",
        type: "video",
        q: query,
        maxResults: "15", // over-fetch: some get filtered out as irrelevant
        videoEmbeddable: "true",
        safeSearch: "strict",
        relevanceLanguage: "en",
        key,
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { cache: "no-store" });
    if (!res.ok) {
        throw new Error(`YouTube API error (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { items?: YouTubeSearchItem[] };
    return data.items ?? [];
}

/**
 * Searches YouTube for one place and replaces its cached videos.
 * Throws on API failure WITHOUT touching the cache or videosCheckedAt, so a
 * quota error never gets recorded as "this place has no videos".
 */
export async function refreshPlaceVideos(placeId: string): Promise<number> {
    const place = await prisma.place.findUnique({
        where: { id: placeId },
        select: { id: true, name: true, city: { select: { name: true } }, country: { select: { name: true } } },
    });
    if (!place) return 0;

    const cityName = place.city?.name ?? null;
    const items = await searchYouTube(`${place.name} ${cityName ?? place.country.name}`);

    const seen = new Set<string>();
    const picked = items
        .filter((i) => i.id.videoId && !seen.has(i.id.videoId) && seen.add(i.id.videoId))
        .filter((i) => isRelevant(i, place.name, cityName))
        .slice(0, MAX_VIDEOS);

    await prisma.$transaction([
        prisma.placeVideo.deleteMany({ where: { placeId } }),
        prisma.placeVideo.createMany({
            data: picked.map((i, idx) => ({
                placeId,
                videoId: i.id.videoId as string,
                title: decodeEntities(i.snippet.title),
                channelTitle: i.snippet.channelTitle ? decodeEntities(i.snippet.channelTitle) : null,
                thumbnailUrl:
                    i.snippet.thumbnails?.high?.url ??
                    i.snippet.thumbnails?.medium?.url ??
                    `https://i.ytimg.com/vi/${i.id.videoId}/hqdefault.jpg`,
                order: idx,
            })),
        }),
        prisma.place.update({ where: { id: placeId }, data: { videosCheckedAt: new Date() } }),
    ]);

    return picked.length;
}

function isStale(checkedAt: Date | null): boolean {
    if (!checkedAt) return true;
    return Date.now() - checkedAt.getTime() > CACHE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Used by the public place page. Returns cached videos; searches only when
 * never checked or stale. Any failure returns whatever is cached (possibly
 * nothing), so the page simply shows no video section.
 */
export async function getPlaceVideos(place: { id: string; videosCheckedAt: Date | null }): Promise<PlaceVideoCard[]> {
    if (isStale(place.videosCheckedAt) && process.env.YOUTUBE_API_KEY) {
        try {
            await refreshPlaceVideos(place.id);
        } catch (err) {
            console.error("[YouTube] refresh failed:", err instanceof Error ? err.message : "unknown error");
        }
    }

    try {
        return await prisma.placeVideo.findMany({
            where: { placeId: place.id },
            orderBy: { order: "asc" },
            select: { videoId: true, title: true, channelTitle: true, thumbnailUrl: true },
        });
    } catch (err) {
        console.error("[YouTube] could not read cached videos:", err instanceof Error ? err.message : "unknown error");
        return [];
    }
}

/** For the cron backfill: places never checked first, then oldest checks. */
export async function pickPlacesNeedingVideos(limit: number) {
    const cutoff = new Date(Date.now() - CACHE_DAYS * 24 * 60 * 60 * 1000);
    return prisma.place.findMany({
        where: { status: "PUBLISHED", OR: [{ videosCheckedAt: null }, { videosCheckedAt: { lt: cutoff } }] },
        orderBy: [{ videosCheckedAt: { sort: "asc", nulls: "first" } }],
        take: limit,
        select: { id: true, name: true },
    });
}