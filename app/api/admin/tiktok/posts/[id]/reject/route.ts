import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    const post = await prisma.tikTokPost.update({ where: { id: params.id }, data: { status: "CANCELLED" } });
    await prisma.tikTokPublishingLog.create({
        data: { postId: post.id, event: "cancelled", message: body.reason ? `Rejected by admin: ${body.reason}` : "Rejected by admin." },
    });

    return NextResponse.json({ ok: true });
}