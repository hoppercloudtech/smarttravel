import { NextRequest, NextResponse } from "next/server";
import { recomputeSeoOpportunities, recomputeSeoHealthBatch } from "@/jobs/seoIntelligence";
import { recomputeAllDiscoveryScores } from "@/jobs/discoverySignals";
import { materializeDiscoveryPages } from "@/lib/pageBuilder";

export async function POST(req: NextRequest) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const opportunities = await recomputeSeoOpportunities();
    const health = await recomputeSeoHealthBatch();
    const signals = await recomputeAllDiscoveryScores();
    const pages = await materializeDiscoveryPages();

    return NextResponse.json({ opportunities, health, signals, pages });
}

export async function GET(req: NextRequest) {
    return POST(req);
}