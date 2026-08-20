import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TikTokPostStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const statusParam = req.nextUrl.searchParams.get("status") as TikTokPostStatus | null;

    const posts = await prisma.tikTokPost.findMany({
        where: statusParam ? { status: statusParam } : undefined,
        orderBy: { scheduledFor: "asc" },
        take: 100,
        include: {
            place: { select: { name: true, category: true, slug: true } },
        },
    });

    return NextResponse.json({ posts });
}