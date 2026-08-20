import { prisma } from "@/lib/prisma";
import { TikTokPostCard, type QueuePost } from "@/components/admin/tiktok/post-card";

export default async function TikTokQueuePage() {
    const posts = await prisma.tikTokPost.findMany({
        where: { status: { in: ["PENDING_REVIEW", "SCHEDULED", "PUBLISHING", "FAILED"] } },
        orderBy: { scheduledFor: "asc" },
        take: 100,
        include: { place: { select: { name: true, category: true, slug: true } } },
    });

    // Day-grouped list — the practical "calendar" for v1. A true drag-and-drop
    // calendar grid is a reasonable follow-up but isn't load-bearing for the
    // core automation working correctly.
    const grouped = new Map<string, QueuePost[]>();
    for (const post of posts) {
        const dayKey = post.scheduledFor.toISOString().slice(0, 10);
        const list = grouped.get(dayKey) ?? [];
        list.push({
            id: post.id,
            status: post.status,
            scheduledFor: post.scheduledFor.toISOString(),
            caption: post.caption,
            hashtags: post.hashtags as unknown as string[],
            mediaUrls: post.mediaUrls as unknown as string[],
            errorMessage: post.errorMessage,
            selectionReason: post.selectionReason as { trendingHotelSlot?: boolean } | null,
            place: post.place,
        });
        grouped.set(dayKey, list);
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-display text-2xl">Content Queue</h1>
                <p className="text-sm text-muted mt-1">Everything pending review, scheduled, publishing, or failed — grouped by day.</p>
            </div>

            {grouped.size === 0 && (
                <p className="text-sm text-muted">Nothing in the queue right now — generate today's batch from the Overview page.</p>
            )}

            {Array.from(grouped.entries()).map(([day, items]) => (
                <div key={day} className="space-y-3">
                    <h2 className="text-sm font-medium text-muted uppercase tracking-wide">
                        {new Date(day + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                    </h2>
                    <div className="space-y-3">
                        {items.map((post) => (
                            <TikTokPostCard key={post.id} post={post} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}