import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { REGIONS } from "@/lib/regions";

import { runDiscoveryAndQueue } from "@/lib/places/placeService";
import type { PlaceCategory } from "@prisma/client";

// Deliberately much more conservative than the free OSM sweep in
// /api/cron/ingest: Google Places is billed per call, so this processes
// exactly ONE region/category combination per invocation rather than
// sweeping every region every run. The combination advances automatically
// each tick using a deterministic rotation based on how many google-*
// batches have run before — this is what "continues from where it stopped"
// means here: no separate pointer table needed, the existing
// IngestionBatch history IS the pointer.
//
// Recommended schedule: once daily, NOT as frequent as the OSM/TikTok
// crons. Each region×category combination will be revisited roughly every
// (regions × categories) days.
const GOOGLE_CATEGORIES: PlaceCategory[] = ["HOTEL", "RESORT", "GUEST_HOUSE", "RESTAURANT", "ATTRACTION", "APARTMENT", "CAMPSITE"];
// AIRBNB excluded — see lib/google/mapping.ts, no Google Places equivalent exists.

export async function POST(req: NextRequest) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Manual override — an admin can request a specific region/category directly.
    if (body.regionKey && body.category) {
        const result = await runDiscoveryAndQueue({ regionKey: body.regionKey, category: body.category, limit: body.limit ?? 20 });
        return NextResponse.json(result);
    }

    const totalCombinations = REGIONS.length * GOOGLE_CATEGORIES.length;
    const priorRuns = await prisma.ingestionBatch.count({ where: { label: { startsWith: "google-" } } });
    const index = priorRuns % totalCombinations;
    const region = REGIONS[Math.floor(index / GOOGLE_CATEGORIES.length)];
    const category = GOOGLE_CATEGORIES[index % GOOGLE_CATEGORIES.length];

    const result = await runDiscoveryAndQueue({ regionKey: region.key, category, limit: 20 });

    return NextResponse.json({ region: region.key, category, ...result });
}

export async function GET(req: NextRequest) {
    return POST(req);
}