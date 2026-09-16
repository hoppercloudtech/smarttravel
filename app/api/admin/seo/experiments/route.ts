import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startExperiment } from "@/lib/seo/experiments";

export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const experiments = await prisma.seoExperiment.findMany({ orderBy: { startedAt: "desc" }, take: 50 });
    return NextResponse.json({ experiments });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const experiment = await startExperiment(body);
    return NextResponse.json({ experiment });
}