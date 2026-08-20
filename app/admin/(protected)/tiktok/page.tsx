import Link from "next/link";
import { CalendarCheck, Send, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TikTokStatusBadge } from "@/components/admin/tiktok/status-badge";
import { GenerateQueueButton } from "@/components/admin/tiktok/generate-queue-button";

export default async function TikTokOverviewPage() {
    const account = await prisma.tikTokAccount.findFirst({ include: { settings: true } });

    if (!account) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="font-display text-2xl">TikTok Automation</h1>
                    <p className="text-sm text-muted mt-1">No TikTok account connected yet.</p>
                </div>
                <Card>
                    <CardContent className="py-10 text-center space-y-4">
                        <p className="text-sm text-muted max-w-md mx-auto">
                            Connect a TikTok account to start automatically publishing eligible places from your
                            database. You'll configure daily post count, approval mode, and posting schedule after connecting.
                        </p>
                        <a href="/api/admin/tiktok/connect">
                            <Button>Connect TikTok Account</Button>
                        </a>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setUTCHours(23, 59, 59, 999);

    const [todayPosts, publishedToday, scheduledCount, failedCount, pendingCount, nextPost] = await Promise.all([
        prisma.tikTokPost.count({ where: { accountId: account.id, scheduledFor: { gte: todayStart, lte: todayEnd } } }),
        prisma.tikTokPost.count({ where: { accountId: account.id, status: "PUBLISHED", publishedAt: { gte: todayStart, lte: todayEnd } } }),
        prisma.tikTokPost.count({ where: { accountId: account.id, status: "SCHEDULED" } }),
        prisma.tikTokPost.count({ where: { accountId: account.id, status: "FAILED" } }),
        prisma.tikTokPost.count({ where: { accountId: account.id, status: "PENDING_REVIEW" } }),
        prisma.tikTokPost.findFirst({
            where: { accountId: account.id, status: { in: ["SCHEDULED", "PENDING_REVIEW"] } },
            orderBy: { scheduledFor: "asc" },
            include: { place: { select: { name: true } } },
        }),
    ]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl">TikTok Automation</h1>
                    <p className="text-sm text-muted mt-1">
                        {account.username ? `Connected: @${account.username}` : `Connected account (openId ${account.openId.slice(0, 8)}…)`}
                    </p>
                </div>
                <GenerateQueueButton />
            </div>

            {!account.isAudited && (
                <div className="rounded-md border border-gold/30 bg-gold/10 px-4 py-3 text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                    <span>
                        This TikTok app hasn't passed TikTok's audit yet. Every post published right now will land as{" "}
                        <strong>private (visible only to the connected account)</strong>, regardless of settings — this
                        is a TikTok platform restriction, not a bug here. Submit your app for audit in the TikTok
                        Developer Portal to lift this once you've verified the full flow works.
                    </span>
                </div>
            )}

            {account.settings && !account.settings.autoPublish && (
                <div className="rounded-md border border-border bg-surface-raised px-4 py-3 text-sm text-muted">
                    Automatic publishing is currently <strong className="text-foreground">OFF</strong>. Scheduled posts
                    will wait for you to publish them manually from the queue.{" "}
                    <Link href="/admin/tiktok/settings" className="text-gold-soft hover:underline">Change this in Settings.</Link>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Today's posts" value={`${publishedToday} / ${todayPosts || account.settings?.dailyPostCount || 0}`} icon={CalendarCheck} tone="gold" />
                <StatCard label="Published today" value={publishedToday} icon={Send} tone="teal" />
                <StatCard label="Scheduled" value={scheduledCount} icon={Clock} tone="teal" />
                <StatCard label="Pending review" value={pendingCount} icon={Sparkles} tone="gold" />
                <StatCard label="Failed" value={failedCount} icon={AlertTriangle} tone="clay" />
            </div>

            <Card>
                <CardHeader><CardTitle>Next post</CardTitle></CardHeader>
                <CardContent>
                    {nextPost ? (
                        <div className="flex items-center justify-between text-sm">
                            <div>
                                <div className="font-medium">{nextPost.place.name}</div>
                                <div className="text-muted text-xs mt-0.5">{nextPost.scheduledFor.toLocaleString()}</div>
                            </div>
                            <TikTokStatusBadge status={nextPost.status} />
                        </div>
                    ) : (
                        <p className="text-sm text-muted">Nothing queued right now — generate today's batch above.</p>
                    )}
                </CardContent>
            </Card>

            <div className="flex gap-3 text-sm">
                <Link href="/admin/tiktok/queue" className="text-gold-soft hover:underline">View full queue →</Link>
                <Link href="/admin/tiktok/settings" className="text-gold-soft hover:underline">Settings →</Link>
            </div>
        </div>
    );
}