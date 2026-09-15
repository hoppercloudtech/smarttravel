import { NextRequest, NextResponse } from "next/server";
import { expireStaleCandidates } from "@/lib/google/candidateQueue";
import { refreshExpiredGoogleCoordinates } from "@/lib/google/coordinateRefresh";

// Run this daily. Two housekeeping jobs, both directly tied to Google's
// storage policy rather than arbitrary cleanup:
//   1. Unreviewed candidates past their 30-day retention window are marked
//      EXPIRED (not deleted outright, kept for audit visibility).
//   2. Published Places whose coordinates came from Google and are past the
//      30-day cache limit get refreshed (cheap, location-only call) or
//      cleared if Google no longer has that place_id.
export async function POST(req: NextRequest) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expiredCandidates = await expireStaleCandidates();
    const coordinateResult = await refreshExpiredGoogleCoordinates();

    return NextResponse.json({ expiredCandidates, coordinates: coordinateResult });
}

export async function GET(req: NextRequest) {
    return POST(req);
}