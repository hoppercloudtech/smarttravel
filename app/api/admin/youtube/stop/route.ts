import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stopRun } from "@/lib/youtubeIngestion";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { runId } = await req.json().catch(() => ({}));
    if (!runId || typeof runId !== "string") return NextResponse.json({ error: "runId is required." }, { status: 400 });

    try {
        return NextResponse.json({ run: await stopRun(runId) });
    } catch (err) {
        console.error("YouTube stop failed", err);
        return NextResponse.json({ error: "Couldn't stop the run." }, { status: 500 });
    }
}