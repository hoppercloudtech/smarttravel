import { MapPin, ImageOff, FileWarning, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { ISSUE_KEYS, ISSUES } from "@/lib/placeIssues";

export default async function AdminOverviewPage() {
  const [total, byCategory, missingImages, needsReview, recent, aiCostAgg, issueCounts] = await Promise.all([
    prisma.place.count(),
    prisma.place.groupBy({ by: ["category"], _count: true }),
    prisma.place.count({ where: { imageStatus: { in: ["PENDING", "NONE_AVAILABLE"] } } }),
    prisma.place.count({ where: { status: "NEEDS_REVIEW" } }),
    prisma.place.findMany({ orderBy: { updatedAt: "desc" }, take: 8, include: { country: true } }),
    prisma.aISummary.aggregate({ _sum: { estCostUsd: true, promptTokens: true, outputTokens: true } }),
    // One count per "missing X" check, using the same definitions as the Places list filters.
    Promise.all(ISSUE_KEYS.map((k) => prisma.place.count({ where: ISSUES[k].where }))),
  ]);

  const categoryCounts = Object.fromEntries(byCategory.map((c) => [c.category, c._count]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl">Overview</h1>
        <p className="text-sm text-muted mt-1">A snapshot of SmartTravel's content, images, and AI spend.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total places" value={total} icon={MapPin} tone="gold" />
        <StatCard label="Missing images" value={missingImages} icon={ImageOff} tone="clay" />
        <StatCard label="Needs review" value={needsReview} icon={FileWarning} tone="clay" />
        <StatCard
          label="AI spend (all time)"
          value={`$${(aiCostAgg._sum.estCostUsd ?? 0).toFixed(2)}`}
          icon={Sparkles}
          tone="teal"
        />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Data quality — places missing info</CardTitle>
          <Link href="/admin/places" className="text-xs text-gold-soft hover:underline">All places</Link>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted mb-4">Tap a card to see exactly which places are missing that field, then tap a place to edit it.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ISSUE_KEYS.map((k, i) => {
              const n = issueCounts[i];
              return (
                <Link
                  key={k}
                  href={`/admin/places?missing=${k}`}
                  className="rounded-md border border-border p-4 transition-colors hover:border-gold/50"
                >
                  <div className="text-xs uppercase text-muted">No {ISSUES[k].label}</div>
                  <div className={`font-display text-xl mt-1 ${n > 0 ? "text-gold-soft" : "text-teal"}`}>{n}</div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Places by category</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.values(CATEGORY_CONFIG).map((c) => (
            <div key={c.slug} className="rounded-md border border-border p-4">
              <div className="text-xs uppercase text-muted">{c.pluralLabel}</div>
              <div className="font-display text-xl mt-1">{categoryCounts[Object.keys(CATEGORY_CONFIG).find(k => CATEGORY_CONFIG[k as keyof typeof CATEGORY_CONFIG] === c) ?? ""] ?? 0}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Recently updated</CardTitle>
          <Link href="/admin/places" className="text-xs text-gold-soft hover:underline">View all places</Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
              <Link href={`/admin/places/${p.id}`} className="hover:text-gold-soft">{p.name}</Link>
              <span className="text-xs text-muted">{p.country.name} · {p.status}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-sm text-muted">No places yet — add your first one.</p>}
        </CardContent>
      </Card>
    </div>
  );
}