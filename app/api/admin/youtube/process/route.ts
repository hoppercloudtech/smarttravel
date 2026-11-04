import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { processRun } from "@/lib/youtubeIngestion";

export const maxDuration = 60;

// The admin page calls this repeatedly; each call handles a small chunk so it
// always fits the serverless time limit.
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await req.json().catch(() => ({}));
    if (!runId || typeof runId !== "string") return NextResponse.json({ error: "runId is required." }, { status: 400 });

    try {
        const { done, run } = await processRun(runId, { maxPlaces: 10, budgetMs: 40_000 });
        return NextResponse.json({ done, run });
    } catch (err) {
        console.error("YouTube process failed", err);
        return NextResponse.json({ error: "Processing failed. Check the server logs." }, { status: 500 });
    }
}