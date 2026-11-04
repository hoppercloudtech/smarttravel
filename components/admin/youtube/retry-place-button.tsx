"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryPlaceButton({ placeId, disabled }: { placeId: string; disabled?: boolean }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    async function retry() {
        setBusy(true);
        setMsg(null);
        try {
            const res = await fetch(`/api/admin/youtube/places/${placeId}/retry`, { method: "POST" });
            const data = await res.json().catch(() => ({}));
            setMsg({ ok: Boolean(data.ok), text: data.message || data.error || "Done." });
            router.refresh();
        } catch {
            setMsg({ ok: false, text: "Retry failed." });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-1">
            <Button variant="outline" size="sm" onClick={retry} disabled={busy || disabled}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Retry
            </Button>
            {msg && <p className={`max-w-[220px] whitespace-normal text-[11px] ${msg.ok ? "text-muted" : "text-clay"}`}>{msg.text}</p>}
        </div>
    );
}