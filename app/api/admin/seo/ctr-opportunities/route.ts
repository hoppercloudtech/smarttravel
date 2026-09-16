import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const opportunities = await prisma.ctrOpportunity.findMany({ where: { resolved: false }, orderBy: { detectedAt: "desc" }, take: 100 });
    return NextResponse.json({ opportunities });
}