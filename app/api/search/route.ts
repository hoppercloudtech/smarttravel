import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/search";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const results = await searchPlaces(q, 8);

  // Log every search for the admin "most searched" analytics panel —
  // fire-and-forget, never blocks the response.
  prisma.searchQueryLog.create({ data: { query: q, resultsCount: results.length } }).catch(() => {});

  return NextResponse.json({ results });
}
