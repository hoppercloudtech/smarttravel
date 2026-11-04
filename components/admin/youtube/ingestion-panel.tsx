"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RunSnapshot } from "@/lib/youtubeIngestion";

type Mode = "ALL" | "ZERO" | "MORE" | "RETRY_UNAVAILABLE" | "PENDING";

const ACTIONS: { mode: Mode; label: string; help: string; primary?: boolean }[] = [
    { mode: "ALL", label: "Ingest all places", help: "Every place with fewer than the target number of videos", primary: true },
    { mode: "ZERO", label: "Ingest places without videos", help: "Places that have zero videos" },
    { mode: "MORE", label: "Find more videos", help: "Places that have some videos but not enough" },
    { mode: "RETRY_UNAVAILABLE", label: "Retry unavailable places", help: "Places previously marked as having no relevant videos" },
    { mode: "PENDING", label: "Process pending", help: "Places waiting in the queue (new places land here)" },
];

const MODE_LABEL: Record<string, string> = {
    ALL: "Ingest all places",
    ZERO: "Places without videos",
    MORE: "Find more videos",
    RETRY_UNAVAILABLE: "Retry unavailable",
    PENDING: "Process pending",
    SCHEDULED: "Scheduled (cron)",
};

const STATUS_TONE = { RUNNING: "gold", COMPLETED: "teal", STOPPED: "clay", FAILED: "clay" } as const;

type Props = {
    initialRun: RunSnapshot | null;
    eligible: Record<Mode, number>;
    searchesLeft: number;
    target: number;
};

export function VideoIngestionPanel({ initialRun, eligible, searchesLeft, target }: Props) {
    const router = useRouter();
    const [run, setRun] = useState<RunSnapshot | null>(initialRun);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
    const stopRef = useRef(false);
    const loopingRef = useRef(false);

    // Keeps asking the server for the next small chunk until the run is done.
    const loop = useCallback(
        async (runId: string) => {
            if (loopingRef.current) return;
            loopingRef.current = true;
            stopRef.current = false;
            setBusy(true);
            try {
                while (!stopRef.current) {
                    const res = await fetch("/api/admin/youtube/process", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ runId }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || "Processing failed.");
                    setRun(data.run);
                    if (data.done) break;
                }
            } catch (e) {
                setMsg({ kind: "error", text: e instanceof Error ? e.message : "Processing failed." });
            } finally {
                loopingRef.current = false;
                setBusy(false);
                router.refresh();
            }
        },
        [router]
    );

    // If the page is opened while a run is active, pick it up again.
    useEffect(() => {
        if (initialRun?.status === "RUNNING") void loop(initialRun.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function start(mode: Mode) {
        const count = eligible[mode];
        if (count === 0) {
            setMsg({ kind: "info", text: "No places match this action right now." });
            return;
        }
        const ok = window.confirm(
            `Search YouTube for up to ${count} place${count === 1 ? "" : "s"}?\n\n` +
            `Each search uses 100 quota units. About ${searchesLeft} searches are left in today's budget; ` +
            `the run stops by itself when it is used up and you can continue tomorrow.`
        );
        if (!ok) return;

        setMsg(null);
        setBusy(true);
        try {
            const res = await fetch("/api/admin/youtube/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 409 && data.run) {
                setRun(data.run);
                setMsg({ kind: "info", text: "A run is already in progress. Showing its progress." });
                void loop(data.run.id);
                return;
            }
            if (!res.ok || !data.ok) {
                setMsg({ kind: data.error ? "error" : "info", text: data.error || data.message || "Couldn't start the run." });
                setBusy(false);
                return;
            }
            setRun(data.run);
            void loop(data.run.id);
        } catch {
            setMsg({ kind: "error", text: "Couldn't start the run." });
            setBusy(false);
        }
    }

    async function stop() {
        if (!run) return;
        stopRef.current = true;
        try {
            const res = await fetch("/api/admin/youtube/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ runId: run.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (data.run) setRun(data.run);
        } finally {
            router.refresh();
        }
    }

    const active = run?.status === "RUNNING";
    const pct = run && run.totalQueued > 0 ? Math.min(100, Math.round((run.processed / run.totalQueued) * 100)) : 0;
    const noNew = run ? Math.max(0, run.processed - run.foundCount - run.unavailableCount - run.failedCount) : 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Run video discovery</CardTitle>
                <p className="text-xs text-muted mt-1">
                    Target: up to {target} relevant videos per place. Only one run can be active at a time. Existing videos are never deleted.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {ACTIONS.map((a) => (
                        <div key={a.mode} className="flex flex-col justify-between gap-3 rounded-md border border-border p-4">
                            <div>
                                <div className="text-sm font-medium">{a.label}</div>
                                <div className="mt-1 text-xs text-muted">{a.help}</div>
                                <div className="mt-2 text-xs text-gold-soft">{eligible[a.mode]} place{eligible[a.mode] === 1 ? "" : "s"} eligible</div>
                            </div>
                            <Button
                                size="sm"
                                variant={a.primary ? "primary" : "outline"}
                                disabled={busy || active || eligible[a.mode] === 0}
                                onClick={() => start(a.mode)}
                            >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                Start
                            </Button>
                        </div>
                    ))}
                </div>

                {msg && <p className={msg.kind === "error" ? "text-xs text-clay" : "text-xs text-muted"}>{msg.text}</p>}

                {run && (
                    <div className="space-y-3 rounded-md border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge tone={STATUS_TONE[run.status as keyof typeof STATUS_TONE] ?? "muted"}>{run.status}</Badge>
                                <span className="text-muted">{MODE_LABEL[run.mode] ?? run.mode}</span>
                            </div>
                            {active && (
                                <Button variant="outline" size="sm" onClick={stop}>
                                    <Square className="h-4 w-4" /> Stop
                                </Button>
                            )}
                        </div>

                        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                            <div className="h-full bg-gold transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted">
                            {run.processed} of {run.totalQueued} places processed ({pct}%)
                        </p>

                        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                            <div><dt className="text-xs text-muted">Videos added</dt><dd className="font-display text-lg">{run.videosAdded}</dd></div>
                            <div><dt className="text-xs text-muted">Places with new videos</dt><dd className="font-display text-lg text-teal">{run.foundCount}</dd></div>
                            <div><dt className="text-xs text-muted">No new videos</dt><dd className="font-display text-lg">{noNew}</dd></div>
                            <div><dt className="text-xs text-muted">Marked unavailable</dt><dd className="font-display text-lg">{run.unavailableCount}</dd></div>
                            <div><dt className="text-xs text-muted">Failed searches</dt><dd className={`font-display text-lg ${run.failedCount > 0 ? "text-clay" : ""}`}>{run.failedCount}</dd></div>
                        </dl>

                        {run.stopReason && <p className="text-xs text-clay">{run.stopReason}</p>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}