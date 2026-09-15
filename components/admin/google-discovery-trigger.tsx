"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { REGIONS } from "@/lib/regions";

const GOOGLE_CATEGORIES = [
    { value: "HOTEL", label: "Hotel" },
    { value: "RESORT", label: "Resort" },
    { value: "GUEST_HOUSE", label: "Guest House" },
    { value: "RESTAURANT", label: "Restaurant" },
    { value: "ATTRACTION", label: "Attraction" },
    { value: "APARTMENT", label: "Apartment" },
    { value: "CAMPSITE", label: "Campsite" },
    // AIRBNB intentionally excluded — no Google Places equivalent, see lib/google/mapping.ts
];

export function GoogleDiscoveryTrigger() {
    const [regionKey, setRegionKey] = useState(REGIONS[0]?.key ?? "kampala");
    const [category, setCategory] = useState("HOTEL");
    const [running, setRunning] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const router = useRouter();

    async function trigger() {
        setRunning(true);
        setMessage(null);
        try {
            const res = await fetch("/api/admin/google-discovery/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ regionKey, category }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Run failed.");
            setMessage(
                data.skipped
                    ? data.reason
                    : `Found ${data.queued + data.matchedExisting + data.alreadyQueued} places — ${data.queued} new, queued for review.`
            );
            router.refresh();
        } catch (err) {
            setMessage(err instanceof Error ? err.message : "Run failed.");
        } finally {
            setRunning(false);
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Select value={regionKey} onChange={(e) => setRegionKey(e.target.value)} className="w-40">
                    {REGIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </Select>
                <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-40">
                    {GOOGLE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
                <Button onClick={trigger} disabled={running} size="sm">
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Run discovery
                </Button>
            </div>
            <p className="text-xs text-clay">This calls the Google Places API and incurs cost per run — use deliberately, not repeatedly.</p>
            {message && <p className="text-xs text-muted">{message}</p>}
        </div>
    );
}