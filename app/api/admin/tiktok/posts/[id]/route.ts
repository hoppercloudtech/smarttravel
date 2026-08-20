import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const EDITABLE_STATUSES = ["PENDING_REVIEW", "SCHEDULED"]; // once PUBLISHING/PUBLISHED, editing is meaningless or dangerous

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.tikTokPost.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (!EDITABLE_STATUSES.includes(existing.status)) {
        return NextResponse.json({ error: `Cannot edit a post with status ${existing.status}.` }, { status: 409 });
    }

    const body = await req.json();
    const post = await prisma.tikTokPost.update({
        where: { id: params.id },
        data: {
            caption: body.caption ?? undefined,
            hashtags: body.hashtags ?? undefined,
            scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
        },
    });

    await prisma.tikTokPublishingLog.create({ data: { postId: post.id, event: "queued", message: "Edited by admin." } });

    return NextResponse.json({ post });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.tikTokPost.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (existing.status === "PUBLISHED") {
        return NextResponse.json({ error: "Cannot cancel a post that's already published." }, { status: 409 });
    }

    const post = await prisma.tikTokPost.update({ where: { id: params.id }, data: { status: "CANCELLED" } });
    await prisma.tikTokPublishingLog.create({ data: { postId: post.id, event: "cancelled", message: "Cancelled by admin." } });

    return NextResponse.json({ ok: true });
}