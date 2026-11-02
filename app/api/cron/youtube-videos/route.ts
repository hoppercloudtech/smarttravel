import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { CATEGORY_CONFIG } from "@/lib/categories";
import {
    isFatalYouTubeError,
    markSearchFailed,
    pickPlacesForSearch,
    searchAndSaveVideos,
    verifyDueVideos,
} from "@/lib/youtube";

export const maxDuration = 60;

// Run daily. Separate from place ingestion on purpose: ingesting places never
// triggers a YouTube search. Each run:
//   1. verifies saved videos that are due (1 quota unit),
//   2. searches a SMALL batch of places that still need a video (100 units each).
// Auth: same Bearer pattern as your other cron routes (INTERNAL_SERVICE_TOKEN);
// CRON_SECRET is also accepted so Vercel Cron works if you set that variable.
function authorized(req: NextRequest): boolean {
    const auth = req.headers.get("authorization");
    const tokens = [process.env.INTERNAL_SERVICE_TOKEN, process.env.CRON_SECRET].filter(Boolean) as string[];
    return tokens.some((t) => auth === `Bearer ${t}`);
}

function revalidatePlace(category: keyof typeof CATEGORY_CONFIG, slug: string) {
    try {
        revalidatePath(`/${CATEGORY_CONFIG[category].slug}/${slug}`);
    } catch {
        /* the page will refresh on its normal 24h cycle */
    }
}

export async function POST(req: NextRequest) {
    if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ?limit=3 lets you test locally for ~300 quota units instead of 3,000.
    const fromQuery = Number(req.nextUrl.searchParams.get("limit"));
    const batch = Math.min(50, Math.max(1, fromQuery || Number(process.env.YOUTUBE_CRON_BATCH ?? 30)));

    let verify: { checked: number; removed: number } | { error: string } = { checked: 0, removed: 0 };
    try {
        const v = await verifyDueVideos();
        verify = { checked: v.checked, removed: v.removed };
        for (const t of v.touched) revalidatePlace(t.category, t.slug);
    } catch (err) {
        verify = { error: err instanceof Error ? err.message : "unknown error" };
        console.error("[YouTube cron] verify failed:", verify.error);
    }

    const places = await pickPlacesForSearch(batch);
    let found = 0, none = 0, failed = 0;
    let stoppedEarly: string | null = null;

    for (const p of places) {
        try {
            const n = await searchAndSaveVideos(p);
            if (n > 0) {
                found++;
                revalidatePlace(p.category, p.slug);
            } else {
                none++;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "unknown error";
            console.error(`[YouTube cron] ${p.name}:`, msg);
            if (isFatalYouTubeError(err)) {
                stoppedEarly = msg.slice(0, 200); // quota/key problem: stop, retry tomorrow, nothing marked as "none found"
                break;
            }
            failed++;
            await markSearchFailed(p.id).catch(() => { });
        }
    }

    return NextResponse.json({ verify, searched: places.length, found, none, failed, stoppedEarly });
}

export async function GET(req: NextRequest) {
    return POST(req);
}