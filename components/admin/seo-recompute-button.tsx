"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SeoRecomputeButton() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function run() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/seo/recompute", { method: "POST" });
            if (!res.ok) throw new Error((await res.json()).error || "Recompute failed.");
            router.refresh();
        } catch (err) {
            alert(err instanceof Error ? err.message : "Recompute failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Button onClick={run} disabled={loading} size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recompute now
        </Button>
    );
}