import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.tikTokPost.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (existing.status !== "PENDING_REVIEW") {
        return NextResponse.json({ error: `Only PENDING_REVIEW posts can be approved (this one is ${existing.status}).` }, { status: 409 });
    }

    const post = await prisma.tikTokPost.update({ where: { id: params.id }, data: { status: "SCHEDULED" } });
    await prisma.tikTokPublishingLog.create({ data: { postId: post.id, event: "queued", message: "Approved by admin — now eligible for auto-publish at its scheduled time." } });

    return NextResponse.json({ post });
}