import { NextRequest, NextResponse } from "next/server";
import { syncSearchPerformance } from "@/lib/searchconsole/sync";
import { detectCtrOpportunities } from "@/lib/seo/ctr";

export async function POST(req: NextRequest) {
    const auth = req.headers.get("authorization");
    // Allow either internal cron (no header) or manual calls with token
    if (auth !== `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}` && req.headers.get("x-vercel-cron") !== "true") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sync = await syncSearchPerformance();
    const ctr = await detectCtrOpportunities();
    return NextResponse.json({ sync, ctr });
}

export async function GET(req: NextRequest) {
    return POST(req);
}