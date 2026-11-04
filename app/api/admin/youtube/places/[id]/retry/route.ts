import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { retryPlace } from "@/lib/youtubeIngestion";

export const maxDuration = 30;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const result = await retryPlace(params.id);
        return NextResponse.json(result);
    } catch (err) {
        console.error("YouTube place retry failed", err);
        return NextResponse.json({ ok: false, message: "Retry failed. Check the server logs." }, { status: 500 });
    }
}