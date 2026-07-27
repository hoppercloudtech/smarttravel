import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateAndStoreSummary } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { placeId } = await req.json();
  if (!placeId) return NextResponse.json({ error: "placeId is required" }, { status: 400 });

  try {
    const result = await generateAndStoreSummary(placeId, "manual-regenerate");
    return NextResponse.json(result);
  } catch (err) {
    console.error("AI regenerate failed", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
