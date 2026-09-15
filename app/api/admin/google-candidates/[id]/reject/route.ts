import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const candidate = await prisma.googlePlaceCandidate.findUnique({ where: { id: params.id } });
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    await prisma.googlePlaceCandidate.update({
        where: { id: params.id },
        data: { status: "REJECTED", reviewedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
}