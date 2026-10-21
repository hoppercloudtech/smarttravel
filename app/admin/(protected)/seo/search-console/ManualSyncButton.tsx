"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ManualSyncButton() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    async function handleSync() {
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch("/api/admin/search-console/manual-sync", {
                method: "POST",
            });
            const data = await res.json();
            setResult(`Synced ${data.sync?.synced ?? 0} rows`);
        } catch (err: any) {
            setResult(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-2">
            <Button onClick={handleSync} disabled={loading}>
                {loading ? "Syncing…" : "Sync Now"}
            </Button>
            {result && <p className="text-sm text-muted">{result}</p>}
        </div>
    );
}
