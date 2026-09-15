import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { GoogleCandidateStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const statusParam = (req.nextUrl.searchParams.get("status") as GoogleCandidateStatus | null) ?? "NEW";

    const candidates = await prisma.googlePlaceCandidate.findMany({
        where: { status: statusParam },
        orderBy: { discoveredAt: "desc" },
        take: 100,
    });

    return NextResponse.json({ candidates });
}