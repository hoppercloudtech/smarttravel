import { Badge } from "@/components/ui/badge";
import type { TikTokPostStatus } from "@prisma/client";

const TONE: Record<TikTokPostStatus, "gold" | "teal" | "muted" | "clay"> = {
    PENDING_REVIEW: "gold",
    SCHEDULED: "teal",
    PUBLISHING: "gold",
    PUBLISHED: "teal",
    FAILED: "clay",
    CANCELLED: "muted",
};

const LABEL: Record<TikTokPostStatus, string> = {
    PENDING_REVIEW: "Pending review",
    SCHEDULED: "Scheduled",
    PUBLISHING: "Publishing",
    PUBLISHED: "Published",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
};

export function TikTokStatusBadge({ status }: { status: TikTokPostStatus }) {
    return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}