import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const maxScore = Number(req.nextUrl.searchParams.get("maxScore") ?? 100);

    const insights = await prisma.seoInsight.findMany({
        where: { kind: "HEALTH_CHECK", score: { lte: maxScore } },
        orderBy: { score: "asc" },
        take: 100,
        include: { place: { select: { name: true, slug: true, category: true } } },
    });

    return NextResponse.json({ insights });
}