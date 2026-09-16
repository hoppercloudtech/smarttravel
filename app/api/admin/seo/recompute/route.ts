import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { recomputeSeoOpportunities, recomputeSeoHealthBatch } from "@/jobs/seoIntelligence";

export async function POST() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const opportunities = await recomputeSeoOpportunities();
    const health = await recomputeSeoHealthBatch();
    return NextResponse.json({ opportunities, health });
}