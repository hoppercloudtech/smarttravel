import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { attemptPublish } from "@/lib/tiktok/publisher";

// Doubles as the "publish now" manual override — used both to retry a
// FAILED post and to force-publish a SCHEDULED post immediately without
// waiting for the scheduler tick (e.g. when autoPublish is OFF).
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.tikTokPost.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (!["FAILED", "SCHEDULED"].includes(existing.status)) {
        return NextResponse.json({ error: `Cannot publish a post with status ${existing.status}.` }, { status: 409 });
    }

    if (existing.status === "FAILED") {
        // Reset the attempt gate so a manual retry isn't immediately blocked by
        // the same max-attempts check that stopped the automatic retries.
        await prisma.tikTokPost.update({ where: { id: existing.id }, data: { attemptCount: 0, errorMessage: null } });
    }

    await attemptPublish(existing.id);
    const post = await prisma.tikTokPost.findUnique({ where: { id: existing.id } });

    return NextResponse.json({ post });
}