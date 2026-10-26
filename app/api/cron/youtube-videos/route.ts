import { NextResponse } from "next/server";
import { pickPlacesNeedingVideos, refreshPlaceVideos } from "@/lib/youtube";

export const maxDuration = 60;

// Backfills/refreshes cached YouTube videos in small batches so the daily
// quota (10,000 units, 100 per search) is never exhausted by one run.
// IMPORTANT: copy the auth check from your existing app/api/cron/*/route.ts
// if it differs from this standard Vercel CRON_SECRET bearer check.
export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const batch = Number(process.env.YOUTUBE_CRON_BATCH ?? 30); // 30 x 100 = 3,000 units/run
    const places = await pickPlacesNeedingVideos(batch);

    let withVideos = 0, noVideos = 0, failed = 0;
    for (const p of places) {
        try {
            const n = await refreshPlaceVideos(p.id);
            if (n > 0) withVideos++;
            else noVideos++;
        } catch (err) {
            failed++;
            console.error(`[YouTube cron] ${p.name}:`, err instanceof Error ? err.message : "unknown error");
            if (err instanceof Error && err.message.includes("(403)")) break; // quota exhausted — stop, retry tomorrow
        }
    }

    return NextResponse.json({ processed: places.length, withVideos, noVideos, failed });
}