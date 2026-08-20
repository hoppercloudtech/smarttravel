import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildDailyQueue } from "@/lib/tiktok/queueBuilder";

export async function POST() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const account = await prisma.tikTokAccount.findFirst();
    if (!account) return NextResponse.json({ error: "Connect a TikTok account first." }, { status: 400 });

    try {
        const result = await buildDailyQueue(account.id);
        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Queue generation failed." }, { status: 500 });
    }
}