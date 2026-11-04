import Link from "next/link";
import { CheckCircle2, Clock, Film, Layers, MapPin, Video, VideoOff, XCircle, AlertTriangle, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoIngestionPanel } from "@/components/admin/youtube/ingestion-panel";
import { RetryPlaceButton } from "@/components/admin/youtube/retry-place-button";
import { DAILY_QUOTA_BUDGET, SEARCH_COST, TARGET_VIDEOS, quotaUsedToday } from "@/lib/youtube";
import { ADMIN_MODES, countForMode, getActiveRun, getVideoStats } from "@/lib/youtubeIngestion";

export const dynamic = "force-dynamic";

const FILTERS = [
    { key: "", label: "All" },
    { key: "zero", label: "No videos" },
    { key: "pending", label: "Pending" },
    { key: "found", label: "Found" },
    { key: "unavailable", label: "Unavailable" },
    { key: "failed", label: "Failed" },
] as const;

const MODE_LABEL: Record<string, string> = {
    ALL: "Ingest all",
    ZERO: "No videos",
    MORE: "Find more",
    RETRY_UNAVAILABLE: "Retry unavailable",
    PENDING: "Pending",
    SCHEDULED: "Scheduled",
};

const statusTone = { FOUND: "teal", PENDING: "gold", NONE_FOUND: "muted", FAILED: "clay" } as const;
const statusLabel = { FOUND: "Found", PENDING: "Pending", NONE_FOUND: "Unavailable", FAILED: "Failed" } as const;
const runTone = { RUNNING: "gold", COMPLETED: "teal", STOPPED: "clay", FAILED: "clay" } as const;

function fmt(d: Date | null) {
    return d ? d.toLocaleDateString() : "—";
}

export default async function YouTubeVideosPage({ searchParams }: { searchParams: { q?: string; filter?: string } }) {
    const q = (searchParams.q ?? "").trim();
    const filter = FILTERS.some((f) => f.key === searchParams.filter) ? (searchParams.filter ?? "") : "";

    const filterWhere: Prisma.PlaceWhereInput =
        filter === "zero" ? { videos: { none: {} } }
            : filter === "pending" ? { videoStatus: "PENDING" }
                : filter === "found" ? { videoStatus: "FOUND" }
                    : filter === "unavailable" ? { videoStatus: "NONE_FOUND" }
                        : filter === "failed" ? { videoStatus: "FAILED" }
                            : {};

    const where: Prisma.PlaceWhereInput = {
        AND: [
            filterWhere,
            q
                ? {
                    OR: [
                        { name: { contains: q, mode: "insensitive" } },
                        { city: { name: { contains: q, mode: "insensitive" } } },
                        { country: { name: { contains: q, mode: "insensitive" } } },
                    ],
                }
                : {},
        ],
    };

    const [stats, activeRun, quotaUsed, eligibleCounts, recentRuns, places, matched] = await Promise.all([
        getVideoStats(),
        getActiveRun(),
        quotaUsedToday(),
        Promise.all(ADMIN_MODES.map((m) => countForMode(m))),
        prisma.videoIngestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
        prisma.place.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            take: 100,
            select: {
                id: true,
                name: true,
                category: true,
                videoStatus: true,
                videosCheckedAt: true,
                videoNextSearchAt: true,
                videoSearchAttempts: true,
                videoFailCount: true,
                city: { select: { name: true } },
                country: { select: { name: true } },
                _count: { select: { videos: true } },
            },
        }),
        prisma.place.count({ where }),
    ]);

    const eligible = Object.fromEntries(ADMIN_MODES.map((m, i) => [m, eligibleCounts[i]])) as Record<
        "ALL" | "ZERO" | "MORE" | "RETRY_UNAVAILABLE" | "PENDING",
        number
    >;
    const quotaLeft = Math.max(0, DAILY_QUOTA_BUDGET - quotaUsed);
    const searchesLeft = Math.floor(quotaLeft / SEARCH_COST);
    const now = new Date();

    function hrefWith(patch: { q?: string; filter?: string }) {
        const next = { q, filter, ...patch };
        const qs = new URLSearchParams();
        if (next.q) qs.set("q", next.q);
        if (next.filter) qs.set("filter", next.filter);
        const s = qs.toString();
        return s ? `/admin/youtube?${s}` : "/admin/youtube";
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="font-display text-2xl">YouTube videos</h1>
                <p className="mt-1 text-sm text-muted">
                    Finds relevant YouTube videos for every place. New places join the queue automatically; this page lets you run discovery on demand.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard label="Total places" value={stats.total} icon={MapPin} tone="gold" />
                <StatCard label="Zero videos" value={stats.zero} icon={VideoOff} tone="clay" />
                <StatCard label="1 video" value={stats.one} icon={Video} tone="gold" />
                <StatCard label="2 videos" value={stats.two} icon={Film} tone="gold" />
                <StatCard label={`${TARGET_VIDEOS}+ videos`} value={stats.threePlus} icon={CheckCircle2} tone="teal" />
                <StatCard label="Waiting (pending)" value={stats.pending} icon={Clock} tone="gold" />
                <StatCard label="Found" value={stats.found} icon={Layers} tone="teal" />
                <StatCard label="Unavailable" value={stats.unavailable} icon={AlertTriangle} tone="clay" />
                <StatCard label="Failed searches" value={stats.failed} icon={XCircle} tone="clay" />
            </div>

            <p className="text-xs text-muted">
                YouTube quota used today by this app: {quotaUsed} of a {DAILY_QUOTA_BUDGET} budget (about {searchesLeft} searches left). It resets at midnight Pacific time.
                Note: other apps using the same API key are not counted here.
            </p>

            <VideoIngestionPanel
                initialRun={activeRun}
                eligible={eligible}
                searchesLeft={searchesLeft}
                target={TARGET_VIDEOS}
            />

            <Card>
                <CardHeader><CardTitle>Recent runs</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <Table className="border-0">
                        <Thead>
                            <tr>
                                <Th>Run</Th>
                                <Th>Status</Th>
                                <Th>Processed</Th>
                                <Th>Places found</Th>
                                <Th>Videos added</Th>
                                <Th>Unavailable</Th>
                                <Th>Failed</Th>
                                <Th>Started</Th>
                            </tr>
                        </Thead>
                        <tbody>
                            {recentRuns.map((r) => (
                                <tr key={r.id}>
                                    <Td className="font-medium">{MODE_LABEL[r.mode] ?? r.mode}<span className="ml-1 text-xs text-muted">({r.triggeredBy})</span></Td>
                                    <Td><Badge tone={runTone[r.status as keyof typeof runTone] ?? "muted"}>{r.status}</Badge></Td>
                                    <Td>{r.processed}/{r.totalQueued}</Td>
                                    <Td>{r.foundCount}</Td>
                                    <Td>{r.videosAdded}</Td>
                                    <Td>{r.unavailableCount}</Td>
                                    <Td className={r.failedCount > 0 ? "text-clay" : undefined}>{r.failedCount}</Td>
                                    <Td className="text-muted">{r.startedAt.toLocaleString()}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    {recentRuns.length === 0 && <p className="p-5 text-sm text-muted">No runs yet.</p>}
                </CardContent>
            </Card>

            <div className="space-y-4">
                <h2 className="font-display text-xl">Places</h2>

                <form action="/admin/youtube" method="get" className="flex flex-wrap gap-2">
                    <div className="relative min-w-[220px] flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                        <input
                            type="search"
                            name="q"
                            defaultValue={q}
                            placeholder="Search by place, city or country…"
                            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-gold/60"
                        />
                    </div>
                    {filter && <input type="hidden" name="filter" value={filter} />}
                    <Button type="submit">Search</Button>
                </form>

                <div className="flex flex-wrap gap-2">
                    {FILTERS.map((f) => (
                        <Link
                            key={f.key}
                            href={hrefWith({ filter: f.key })}
                            className={
                                "rounded-full border px-3 py-1 text-xs transition-colors " +
                                (filter === f.key ? "border-gold bg-gold/15 text-gold-soft" : "border-border text-muted hover:border-gold/50 hover:text-gold-soft")
                            }
                        >
                            {f.label}
                        </Link>
                    ))}
                </div>

                <p className="text-xs text-muted">{matched} place{matched === 1 ? "" : "s"}{matched > 100 ? " (showing the latest 100)" : ""}</p>

                <Table>
                    <Thead>
                        <tr>
                            <Th>Place</Th>
                            <Th>Videos</Th>
                            <Th>Status</Th>
                            <Th>Last search</Th>
                            <Th>Next search</Th>
                            <Th>Actions</Th>
                        </tr>
                    </Thead>
                    <tbody>
                        {places.map((p) => {
                            const count = p._count.videos;
                            const next =
                                p.videoStatus === "FOUND" && count >= TARGET_VIDEOS
                                    ? "Complete"
                                    : p.videoNextSearchAt && p.videoNextSearchAt > now
                                        ? fmt(p.videoNextSearchAt)
                                        : "Eligible now";
                            return (
                                <tr key={p.id} className="hover:bg-surface-raised/50">
                                    <Td>
                                        <Link href={`/admin/places/${p.id}`} className="font-medium hover:text-gold-soft">{p.name}</Link>
                                        <div className="text-xs text-muted">{[p.city?.name, p.country.name].filter(Boolean).join(", ")}</div>
                                    </Td>
                                    <Td className={count === 0 ? "text-clay" : undefined}>{count} / {TARGET_VIDEOS}</Td>
                                    <Td>
                                        <Badge tone={statusTone[p.videoStatus]}>{statusLabel[p.videoStatus]}</Badge>
                                        {p.videoFailCount > 0 && <div className="mt-1 text-[11px] text-clay">{p.videoFailCount} failed attempt{p.videoFailCount === 1 ? "" : "s"}</div>}
                                    </Td>
                                    <Td className="text-muted">{fmt(p.videosCheckedAt)}</Td>
                                    <Td className="text-muted">{next}</Td>
                                    <Td><RetryPlaceButton placeId={p.id} disabled={count >= TARGET_VIDEOS} /></Td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Table>
                {places.length === 0 && <p className="text-sm text-muted">No places match.</p>}
            </div>
        </div>
    );
}