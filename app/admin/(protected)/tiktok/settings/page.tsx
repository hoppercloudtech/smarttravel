import { prisma } from "@/lib/prisma";
import { TikTokSettingsForm } from "@/components/admin/tiktok/settings-form";
import { Button } from "@/components/ui/button";

export default async function TikTokSettingsPage({ searchParams }: { searchParams: { error?: string } }) {
    const account = await prisma.tikTokAccount.findFirst({ include: { settings: true } });

    if (!account) {
        return (
            <div className="space-y-6">
                <h1 className="font-display text-2xl">TikTok Settings</h1>
                {searchParams.error && (
                    <p className="text-sm text-clay">
                        {searchParams.error === "invalid_oauth_state" ? "The connection attempt expired or was invalid — try again." : "Connection failed — try again."}
                    </p>
                )}
                <p className="text-sm text-muted">Connect a TikTok account before configuring settings.</p>
                <a href="/api/admin/tiktok/connect"><Button>Connect TikTok Account</Button></a>
            </div>
        );
    }

    const settings = account.settings ?? {
        dailyPostCount: 5,
        minHotelPostsPerDay: 2,
        autoPublish: false,
        approvalRequired: true,
        cooldownDays: 30,
        postingTimezone: "UTC",
        postingWindows: ["08:00", "11:00", "14:00", "18:00", "21:00"],
        hashtagBaseTags: ["Travel", "TravelTok", "Explore"],
        ctaVariants: ["Discover more through the link in our bio."],
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl">TikTok Settings</h1>
                <p className="text-sm text-muted mt-1">
                    {account.username ? `@${account.username}` : account.openId} · {account.isAudited ? "Audited (public posting enabled)" : "Not yet audited (posts are private)"}
                </p>
            </div>
            <TikTokSettingsForm
                initial={{
                    dailyPostCount: settings.dailyPostCount,
                    minHotelPostsPerDay: settings.minHotelPostsPerDay,
                    autoPublish: settings.autoPublish,
                    approvalRequired: settings.approvalRequired,
                    cooldownDays: settings.cooldownDays,
                    postingTimezone: settings.postingTimezone,
                    postingWindows: settings.postingWindows as unknown as string[],
                    hashtagBaseTags: settings.hashtagBaseTags as unknown as string[],
                    ctaVariants: settings.ctaVariants as unknown as string[],
                }}
            />
        </div>
    );
}