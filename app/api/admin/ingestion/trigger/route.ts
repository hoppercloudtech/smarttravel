import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runIngestionBatch } from "@/jobs/ingest";
import type { PlaceCategory } from "@prisma/client";

// Lets an admin manually kick off a batch from the dashboard, using the same
// pipeline the nightly cron job calls — no separate code path to maintain.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { country, category } = await req.json();
  const batch = await runIngestionBatch({ country, category: category as PlaceCategory, limit: 25 });
  return NextResponse.json(batch);
}
