import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ADMIN_MODES, startRun, type VideoRunMode } from "@/lib/youtubeIngestion";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { mode } = await req.json().catch(() => ({}));
    if (!ADMIN_MODES.includes(mode)) return NextResponse.json({ error: "Unknown mode." }, { status: 400 });

    try {
        const result = await startRun(mode as VideoRunMode, "admin");
        if (result.ok) return NextResponse.json({ ok: true, run: result.run });
        if (result.reason === "already_running") {
            return NextResponse.json(
                { ok: false, reason: result.reason, run: result.run, message: "A run is already in progress." },
                { status: 409 }
            );
        }
        return NextResponse.json({ ok: false, reason: result.reason, message: "No places match this action right now." });
    } catch (err) {
        console.error("YouTube start failed", err);
        return NextResponse.json({ error: "Couldn't start the run. Check the server logs." }, { status: 500 });
    }
}