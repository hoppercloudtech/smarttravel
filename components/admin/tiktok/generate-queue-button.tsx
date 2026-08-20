"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenerateQueueButton() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const router = useRouter();

    async function trigger() {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/tiktok/generate", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Generation failed.");
            setMessage(data.skipped ? data.reason : `Created ${data.created} post(s) for today.`);
            router.refresh();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="text-right">
            <Button onClick={trigger} disabled={loading} size="sm">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate today's queue
            </Button>
            {message && <p className="text-xs text-muted mt-1.5 max-w-xs">{message}</p>}
        </div>
    );
}