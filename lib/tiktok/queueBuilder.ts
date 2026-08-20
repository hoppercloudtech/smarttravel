// lib/tiktok/queueBuilder.ts
//
// Builds one day's TikTok post queue: selects eligible Places, scores and
// diversifies them, generates captions/hashtags, and schedules them across
// the configured posting windows. Idempotent — safe to call repeatedly for
// the same day; it no-ops if that day's queue already exists.
//
// Requires `date-fns-tz` (npm install date-fns-tz) for correct IANA
// timezone → UTC conversion — hand-rolling DST-aware offset math is not
// something to do by hand in a production system.

import { prisma } from "@/lib/prisma";
import { scoreCandidate, type ScoringWeights } from "@/lib/tiktok/scoring";
import { generateTikTokCaption } from "@/lib/tiktok/caption";
import { fromZonedTime } from "date-fns-tz";
import type { PlaceCategory } from "@prisma/client";

// "Popular hotels or accommodations" per the brief — mapped onto the actual
// categories that exist in the schema today.
const ACCOMMODATION_CATEGORIES: PlaceCategory[] = ["HOTEL", "RESORT", "GUEST_HOUSE", "AIRBNB", "APARTMENT"];

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
    HOTEL: "Hotel",
    RESORT: "Resort",
    RESTAURANT: "Restaurant",
    AIRBNB: "Airbnb",
    GUEST_HOUSE: "Guest House",
    APARTMENT: "Apartment",
    CAMPSITE: "Campsite",
    ATTRACTION: "Attraction",
};

function parseWindowToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
}

/** Maps N posts onto the configured posting windows — using them directly if
 * counts match, otherwise interpolating evenly across the configured span so
 * changing dailyPostCount doesn't require re-curating postingWindows. */
function computeScheduleMinutes(windows: string[], count: number): number[] {
    const parsed = [...windows].map(parseWindowToMinutes).sort((a, b) => a - b);
    if (parsed.length === 0) throw new Error("postingWindows is empty — configure at least one posting time in settings.");
    if (parsed.length === count) return parsed;
    if (count === 1) return [parsed[0]];

    const start = parsed[0];
    const end = parsed[parsed.length - 1];
    const step = (end - start) / (count - 1);
    return Array.from({ length: count }, (_, i) => Math.round(start + step * i));
}

type ScoredCandidate = {
    place: Awaited<ReturnType<typeof loadEligiblePlaces>>[number];
    breakdown: ReturnType<typeof scoreCandidate>;
};

async function loadEligiblePlaces(excludePlaceIds: string[]) {
    return prisma.place.findMany({
        where: {
            status: "PUBLISHED",
            media: { some: {} }, // hard rule: no image, no eligibility — never relaxed
            id: { notIn: excludePlaceIds },
        },
        include: { media: { orderBy: { order: "asc" } }, city: true, country: true },
    });
}

export type BuildQueueResult =
    | { skipped: true; reason: string; created: 0 }
    | { skipped: false; created: number; hotelSlotsFilled: number };

export async function buildDailyQueue(accountId: string, forDate: Date = new Date()): Promise<BuildQueueResult> {
    const account = await prisma.tikTokAccount.findUniqueOrThrow({
        where: { id: accountId },
        include: { settings: true },
    });
    const settings = account.settings;
    if (!settings) throw new Error("TikTokPostingSettings not configured for this account yet — visit Settings first.");

    const dayKey = forDate.toISOString().slice(0, 10);
    const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
    const dayEnd = new Date(`${dayKey}T23:59:59.999Z`);

    const alreadyBuilt = await prisma.tikTokPost.count({
        where: { accountId, scheduledFor: { gte: dayStart, lte: dayEnd } },
    });
    if (alreadyBuilt > 0) {
        return { skipped: true, reason: `Queue for ${dayKey} already has ${alreadyBuilt} post(s) — not rebuilding.`, created: 0 };
    }

    // Cooldown: exclude places posted (or already queued to post) within the
    // configured window, so the same place doesn't repeat too soon.
    const cooldownCutoff = new Date(Date.now() - settings.cooldownDays * 24 * 60 * 60 * 1000);
    const recentlyPostedPlaceIds = (
        await prisma.tikTokPost.findMany({
            where: {
                accountId,
                status: { in: ["SCHEDULED", "PUBLISHING", "PUBLISHED", "PENDING_REVIEW"] },
                scheduledFor: { gte: cooldownCutoff },
            },
            select: { placeId: true },
        })
    ).map((p) => p.placeId);

    const eligiblePlaces = await loadEligiblePlaces(recentlyPostedPlaceIds);

    if (eligiblePlaces.length === 0) {
        return {
            skipped: true,
            reason: "No eligible places found — everything either lacks a photo or is within the repost cooldown window.",
            created: 0,
        };
    }

    const maxViewCount = Math.max(1, ...eligiblePlaces.map((p) => p.viewCount));
    const weights = settings.scoringWeights as unknown as ScoringWeights;

    const scored: ScoredCandidate[] = eligiblePlaces.map((place) => ({
        place,
        breakdown: scoreCandidate(
            {
                id: place.id,
                viewCount: place.viewCount,
                featured: place.featured,
                createdAt: place.createdAt,
                updatedAt: place.updatedAt,
                mediaCount: place.media.length,
                hasHeroImage: place.media.some((m) => m.isHero),
            },
            maxViewCount,
            weights
        ),
    }));

    // --- Greedy selection with diversity penalties ---
    const selected: ScoredCandidate[] = [];
    const selectedIds = new Set<string>();
    const usedCityIds = new Set<string>();
    const usedCategories: PlaceCategory[] = [];

    function pickBest(pool: ScoredCandidate[]): ScoredCandidate | null {
        let best: ScoredCandidate | null = null;
        let bestAdjusted = -Infinity;
        for (const candidate of pool) {
            if (selectedIds.has(candidate.place.id)) continue;
            let adjusted = candidate.breakdown.total;
            if (candidate.place.cityId && usedCityIds.has(candidate.place.cityId)) adjusted -= weights.geoDiversity;
            if (usedCategories.includes(candidate.place.category)) adjusted -= weights.categoryDiversity;
            if (adjusted > bestAdjusted) {
                bestAdjusted = adjusted;
                best = candidate;
            }
        }
        return best;
    }

    function commit(pick: ScoredCandidate) {
        selected.push(pick);
        selectedIds.add(pick.place.id);
        if (pick.place.cityId) usedCityIds.add(pick.place.cityId);
        usedCategories.push(pick.place.category);
    }

    // 1. Fill the "popular hotel/accommodation" quota first.
    const accommodationPool = scored.filter((s) => ACCOMMODATION_CATEGORIES.includes(s.place.category));
    const hotelQuota = Math.min(settings.minHotelPostsPerDay, accommodationPool.length);
    for (let i = 0; i < hotelQuota; i++) {
        const pick = pickBest(accommodationPool);
        if (!pick) break;
        commit(pick);
    }

    // 2. Fill remaining slots from the full pool — accommodations can still
    //    win these slots if they genuinely score best, per "dynamically choose
    //    the best available content" rather than a rigid category assignment.
    const remainingSlots = Math.max(0, settings.dailyPostCount - selected.length);
    for (let i = 0; i < remainingSlots; i++) {
        const pick = pickBest(scored);
        if (!pick) break; // ran out of eligible content — never invent placeholders
        commit(pick);
    }

    if (selected.length === 0) {
        return { skipped: true, reason: "Selection produced zero candidates after diversity filtering.", created: 0 };
    }

    // --- Schedule times, spread across the configured windows/timezone ---
    const minutesOfDay = computeScheduleMinutes(settings.postingWindows as unknown as string[], selected.length);
    const scheduledTimes = minutesOfDay.map((minutes) => {
        const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
        const mm = String(minutes % 60).padStart(2, "0");
        return fromZonedTime(`${dayKey} ${hh}:${mm}:00`, settings.postingTimezone);
    });

    const ctaVariants = settings.ctaVariants as unknown as string[];
    const baseTags = settings.hashtagBaseTags as unknown as string[];

    let created = 0;
    for (let i = 0; i < selected.length; i++) {
        const { place, breakdown } = selected[i];
        const ctaVariant = ctaVariants[i % ctaVariants.length] ?? ctaVariants[0];

        let caption = `Discover ${place.name} — one of the places worth knowing about in ${place.city?.name ?? place.country.name}.`;
        let hashtags: string[] = baseTags;
        let captionGenerationFailed = false;

        try {
            const generated = await generateTikTokCaption({
                placeName: place.name,
                category: CATEGORY_LABELS[place.category],
                cityName: place.city?.name,
                countryName: place.country.name,
                aiSummary: place.description,
                baseTags,
                ctaVariant,
            });
            caption = generated.caption;
            hashtags = generated.hashtags;
        } catch {
            // A caption failure shouldn't sink the whole batch — fall back to a
            // plain caption and flag it in the log so an admin can review/edit it
            // before it goes out, rather than silently shipping a worse caption.
            captionGenerationFailed = true;
        }

        const post = await prisma.tikTokPost.create({
            data: {
                accountId,
                placeId: place.id,
                status: settings.approvalRequired ? "PENDING_REVIEW" : "SCHEDULED",
                mediaType: "PHOTO_CAROUSEL",
                mediaUrls: place.media.map((m) => m.url),
                caption,
                hashtags,
                ctaVariant,
                selectionScore: breakdown.total,
                selectionReason: {
                    popularity: breakdown.popularity,
                    freshness: breakdown.freshness,
                    imageQuality: breakdown.imageQuality,
                    trendingHotelSlot: i < hotelQuota,
                },
                scheduledFor: scheduledTimes[i],
            },
        });

        await prisma.tikTokPublishingLog.create({
            data: {
                postId: post.id,
                event: captionGenerationFailed ? "queued" : "queued",
                message: captionGenerationFailed
                    ? `Selected for ${dayKey}. Caption generation failed — using fallback caption; review before publish.`
                    : `Selected for ${dayKey} (score ${breakdown.total.toFixed(3)}).`,
            },
        });

        created++;
    }

    return { skipped: false, created, hotelSlotsFilled: hotelQuota };
}