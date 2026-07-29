import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runIngestionBatch } from "@/jobs/ingest";
import { GeocodeError } from "@/lib/geocode";
import type { PlaceCategory } from "@prisma/client";

// Lets an admin manually kick off a batch from the dashboard, using the same
// pipeline the nightly cron job calls — no separate code path to maintain.
// Accepts EITHER a preset regionKey OR a free-text { district, country } —
// see components/admin/ingestion-trigger.tsx for the two-mode UI.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { regionKey, district, country, category } = await req.json();

  try {
    const batch = await runIngestionBatch({
      regionKey: regionKey || undefined,
      customLocation: district && country ? { district, country } : undefined,
      category: category as PlaceCategory,
      limit: 25,
    });
    return NextResponse.json(batch);
  } catch (err) {
    if (err instanceof GeocodeError) {
      // A GeocodeError message is written to be admin-readable — pass it
      // straight through rather than a generic 500.
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Ingestion trigger failed", err);
    return NextResponse.json({ error: "The batch failed to run. Check the server logs for details." }, { status: 500 });
  }
}