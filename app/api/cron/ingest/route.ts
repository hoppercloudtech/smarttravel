import { NextRequest, NextResponse } from "next/server";
import { runIngestionBatch } from "@/jobs/ingest";
import { REGIONS } from "@/lib/regions";
import type { PlaceCategory } from "@prisma/client";

const CATEGORY_ROTATION: PlaceCategory[] = ["HOTEL", "RESTAURANT", "ATTRACTION", "AIRBNB", "RESORT"];

// Triggered on a schedule by Vercel Cron (see vercel.json) or manually by an
// admin action. Protected by a bearer token — never reachable by the public.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (body.regionKey || (body.district && body.country)) {
    const batch = await runIngestionBatch({
      regionKey: body.regionKey || undefined,
      customLocation: body.district && body.country ? { district: body.district, country: body.country } : undefined,
      category: body.category ?? "HOTEL",
      limit: body.limit ?? 25,
    });
    return NextResponse.json(batch);
  }

  // No region/district specified — this is what the nightly Vercel Cron hit
  // actually triggers, since it can't carry a custom body. Sweep every
  // preset region for one category, rotating category by day, so coverage
  // grows on its own without manual triggers.
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const category = CATEGORY_ROTATION[dayOfYear % CATEGORY_ROTATION.length];

  const results = [];
  for (const region of REGIONS) {
    const batch = await runIngestionBatch({ regionKey: region.key, category, limit: 25 });
    results.push({ region: region.key, status: batch.status, inserted: batch.totalInserted });
  }

  return NextResponse.json({ category, regionsProcessed: results.length, results });
}

// Vercel Cron sends GET requests by default — support both.
export async function GET(req: NextRequest) {
  return POST(req);
}