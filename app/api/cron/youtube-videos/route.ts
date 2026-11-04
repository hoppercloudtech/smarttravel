import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { verifyDueVideos } from "@/lib/youtube";
import { finishRun, processRun, startRun } from "@/lib/youtubeIngestion";

export const maxDuration = 60;

// Scheduled discovery. Vercel Hobby runs this once a day; you can also call it more
// often from an external scheduler. That is safe: only one run can be active at a
// time, the daily quota budget caps spending, and every retry date is respected.
// Separate from place ingestion on purpose: saving a place only marks it PENDING.
//
// Auth: same Bearer pattern as your other cron routes (INTERNAL_SERVICE_TOKEN);
// CRON_SECRET is accepted too so Vercel Cron works if you set that variable.
function authorized(req: NextRequest): boolean {
    const auth = req.headers.get("authorization");
    const tokens = [process.env.INTERNAL_SERVICE_TOKEN, process.env.CRON_SECRET].filter(Boolean) as string[];
    return tokens.some((t) => auth === `Bearer ${t}`);
}

export async function POST(req: NextRequest) {
    if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. availability check of saved videos (1 quota unit per call)
    let verify: { checked: number; removed: number } | { error: string } = { checked: 0, removed: 0 };
    try {
        const v = await verifyDueVideos();
        verify = { checked: v.checked, removed: v.removed };
        for (const t of v.touched) {
            try {
                revalidatePath(`/${CATEGORY_CONFIG[t.category].slug}/${t.slug}`);
            } catch {
                /* refreshes on its normal cycle */
            }
        }
    } catch (err) {
        verify = { error: err instanceof Error ? err.message : "unknown error" };
        console.error("[YouTube cron] verify failed:", verify.error);
    }

    // 2. scheduled discovery run (places that are due: new, top-up, retries)
    const started = await startRun("SCHEDULED", "cron");
    if (!started.ok) return NextResponse.json({ verify, skipped: started.reason });

    // ?limit=3 lets you test for ~300 quota units instead of a full batch
    const fromQuery = Number(req.nextUrl.searchParams.get("limit"));
    const batch = Math.min(90, Math.max(1, fromQuery || Number(process.env.YOUTUBE_CRON_BATCH ?? 30)));

    const { done, run } = await processRun(started.run.id, { maxPlaces: batch, budgetMs: 45_000 });
    const final = done ? run : await finishRun(started.run.id, "COMPLETED", "Batch limit reached; the rest continues on the next run");

    return NextResponse.json({ verify, run: final });
}

export async function GET(req: NextRequest) {
    return POST(req);
}