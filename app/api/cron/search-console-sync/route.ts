import { NextRequest, NextResponse } from "next/server";
import { syncSearchPerformance } from "@/lib/searchconsole/sync";
import { detectCtrOpportunities } from "@/lib/seo/ctr";

export async function POST(req: NextRequest) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sync = await syncSearchPerformance();
    const ctr = await detectCtrOpportunities();
    return NextResponse.json({ sync, ctr });
}

export async function GET(req: NextRequest) {
    return POST(req);
}