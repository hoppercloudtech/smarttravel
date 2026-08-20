import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const account = await prisma.tikTokAccount.findFirst({ include: { settings: true } });
    if (!account) return NextResponse.json({ account: null, settings: null });

    return NextResponse.json({
        account: { id: account.id, username: account.username, status: account.status, isAudited: account.isAudited, connectedAt: account.connectedAt },
        settings: account.settings,
    });
}

export async function PATCH(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const account = await prisma.tikTokAccount.findFirst();
    if (!account) return NextResponse.json({ error: "No TikTok account connected yet." }, { status: 400 });

    const settings = await prisma.tikTokPostingSettings.upsert({
        where: { accountId: account.id },
        update: {
            dailyPostCount: body.dailyPostCount,
            minHotelPostsPerDay: body.minHotelPostsPerDay,
            autoPublish: body.autoPublish,
            approvalRequired: body.approvalRequired,
            cooldownDays: body.cooldownDays,
            postingTimezone: body.postingTimezone,
            postingWindows: body.postingWindows,
            scoringWeights: body.scoringWeights,
            hashtagBaseTags: body.hashtagBaseTags,
            ctaVariants: body.ctaVariants,
        },
        create: {
            accountId: account.id,
            dailyPostCount: body.dailyPostCount ?? 5,
            minHotelPostsPerDay: body.minHotelPostsPerDay ?? 2,
            autoPublish: body.autoPublish ?? false,
            approvalRequired: body.approvalRequired ?? true,
            cooldownDays: body.cooldownDays ?? 30,
            postingTimezone: body.postingTimezone ?? "UTC",
            postingWindows: body.postingWindows ?? ["08:00", "11:00", "14:00", "18:00", "21:00"],
            scoringWeights: body.scoringWeights ?? { popularity: 0.35, freshness: 0.2, imageQuality: 0.15, categoryDiversity: 0.15, geoDiversity: 0.15 },
            hashtagBaseTags: body.hashtagBaseTags ?? ["Travel", "TravelTok", "Explore"],
            ctaVariants: body.ctaVariants ?? ["Discover more through the link in our bio."],
        },
    });

    return NextResponse.json({ settings });
}