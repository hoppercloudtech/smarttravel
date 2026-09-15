import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runDiscoveryAndQueue } from "@/lib/places/placeService";
import type { PlaceCategory } from "@prisma/client";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { regionKey, category } = await req.json();
    if (!regionKey || !category) return NextResponse.json({ error: "regionKey and category are required." }, { status: 400 });

    try {
        const result = await runDiscoveryAndQueue({ regionKey, category: category as PlaceCategory, limit: 20 });
        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Discovery run failed." }, { status: 500 });
    }
}