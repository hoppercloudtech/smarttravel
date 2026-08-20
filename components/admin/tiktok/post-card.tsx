"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TikTokStatusBadge } from "@/components/admin/tiktok/status-badge";

export type QueuePost = {
    id: string;
    status: "PENDING_REVIEW" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";
    scheduledFor: string;
    caption: string;
    hashtags: string[];
    mediaUrls: string[];
    errorMessage: string | null;
    selectionReason: { trendingHotelSlot?: boolean } | null;
    place: { name: string; category: string; slug: string };
};

export function TikTokPostCard({ post }: { post: QueuePost }) {
    const [busy, setBusy] = useState<string | null>(null);
    const router = useRouter();

    async function call(action: string, url: string, method: string = "POST") {
        setBusy(action);
        try {
            const res = await fetch(url, { method });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Action failed.");
            }
            router.refresh();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Action failed.");
        } finally {
            setBusy(null);
        }
    }

    return (
        <Card>
            <CardContent className="flex gap-4">
                <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden bg-surface-raised">
                    {post.mediaUrls[0] && <img src={post.mediaUrls[0]} alt="" className="w-full h-full object-cover" />}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm truncate">{post.place.name}</div>
                        <TikTokStatusBadge status={post.status} />
                    </div>
                    <div className="text-xs text-muted">
                        {new Date(post.scheduledFor).toLocaleString()} · {post.place.category}
                        {post.selectionReason?.trendingHotelSlot && " · Trending hotel slot"}
                    </div>
                    <p className="text-sm text-muted line-clamp-2">{post.caption}</p>
                    <div className="flex flex-wrap gap-1">
                        {post.hashtags.slice(0, 6).map((h) => (
                            <span key={h} className="text-xs text-gold-soft">#{h}</span>
                        ))}
                    </div>
                    {post.errorMessage && <p className="text-xs text-clay">{post.errorMessage}</p>}

                    <div className="flex gap-2 pt-1">
                        {post.status === "PENDING_REVIEW" && (
                            <>
                                <Button size="sm" variant="secondary" onClick={() => call("approve", `/api/admin/tiktok/posts/${post.id}/approve`)} disabled={!!busy}>
                                    {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => call("reject", `/api/admin/tiktok/posts/${post.id}/reject`)} disabled={!!busy}>
                                    {busy === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Reject
                                </Button>
                            </>
                        )}
                        {post.status === "SCHEDULED" && (
                            <>
                                <Button size="sm" variant="secondary" onClick={() => call("retry", `/api/admin/tiktok/posts/${post.id}/retry`)} disabled={!!busy}>
                                    {busy === "retry" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Publish now
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => call("cancel", `/api/admin/tiktok/posts/${post.id}`, "DELETE")} disabled={!!busy}>
                                    {busy === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Cancel
                                </Button>
                            </>
                        )}
                        {post.status === "FAILED" && (
                            <Button size="sm" variant="secondary" onClick={() => call("retry", `/api/admin/tiktok/posts/${post.id}/retry`)} disabled={!!busy}>
                                {busy === "retry" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Retry
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}