import { NextRequest, NextResponse } from "next/server";
import { runIngestionBatch } from "@/jobs/ingest";

// Triggered on a schedule by Vercel Cron (see vercel.json) or manually by an
// admin action. Protected by a bearer token — never reachable by the public.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const country = body.country ?? "Uganda";
  const category = body.category ?? "HOTEL";
  const limit = body.limit ?? 25;

  const batch = await runIngestionBatch({ country, category, limit });
  return NextResponse.json(batch);
}

// Vercel Cron sends GET requests by default — support both.
export async function GET(req: NextRequest) {
  return POST(req);
}
