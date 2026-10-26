import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import type { Prisma, PlaceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Table, Thead, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_CONFIG } from "@/lib/categories";
import {
  ISSUE_KEYS,
  ISSUES,
  ISSUE_COUNTS,
  buildMissingWhere,
  getMissing,
  parseMissingParam,
  type IssueKey,
} from "@/lib/placeIssues";

const STATUSES: PlaceStatus[] = ["DRAFT", "PUBLISHED", "NEEDS_REVIEW", "ARCHIVED"];
const LIMIT = 500;

type SearchParams = { q?: string; missing?: string; status?: string };

function hrefWith(sp: { q: string; missing: IssueKey[]; status: string }, patch: Partial<{ q: string; missing: IssueKey[]; status: string }>) {
  const next = { ...sp, ...patch };
  const qs = new URLSearchParams();
  if (next.q) qs.set("q", next.q);
  if (next.missing.length) qs.set("missing", next.missing.join(","));
  if (next.status) qs.set("status", next.status);
  const s = qs.toString();
  return s ? `/admin/places?${s}` : "/admin/places";
}

export default async function AdminPlacesListPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? "").trim();
  const missing = parseMissingParam(searchParams.missing);
  const status = STATUSES.includes(searchParams.status as PlaceStatus) ? (searchParams.status as string) : "";
  const current = { q, missing, status };

  const where: Prisma.PlaceWhereInput = {
    AND: [
      buildMissingWhere(missing),
      status ? { status: status as PlaceStatus } : {},
      q
        ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { district: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
            { city: { name: { contains: q, mode: "insensitive" } } },
            { country: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
        : {},
    ],
  };

  const [places, matched, total] = await Promise.all([
    prisma.place.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
      include: { country: true, city: true, _count: ISSUE_COUNTS },
    }),
    prisma.place.count({ where }),
    prisma.place.count(),
  ]);

  const statusTone = { PUBLISHED: "teal", DRAFT: "muted", NEEDS_REVIEW: "clay", ARCHIVED: "muted" } as const;
  const filtered = q || missing.length > 0 || status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Places</h1>
          <p className="text-sm text-muted mt-1">
            {filtered ? `${matched} of ${total} places match` : `${total} total`}
            {matched > LIMIT && ` · showing first ${LIMIT}`}
          </p>
        </div>
        <Link href="/admin/places/new">
          <Button><Plus className="h-4 w-4" /> Add place</Button>
        </Link>
      </div>

      {/* Search: plain GET form, so it works without client JS and keeps filters in the URL */}
      <form action="/admin/places" method="get" className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, city, district, address or country…"
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-gold/60"
          />
        </div>
        {missing.length > 0 && <input type="hidden" name="missing" value={missing.join(",")} />}
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <Button type="submit">Search</Button>
        {filtered && (
          <Link href="/admin/places" className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground">
            <X className="h-4 w-4" /> Clear
          </Link>
        )}
      </form>

      {/* Missing-data filters: tap to toggle; several can be combined (place must lack ALL selected) */}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted mb-2">Show places missing</div>
        <div className="flex flex-wrap gap-2">
          {ISSUE_KEYS.map((k) => {
            const active = missing.includes(k);
            const next = active ? missing.filter((m) => m !== k) : [...missing, k];
            return (
              <Link
                key={k}
                href={hrefWith(current, { missing: next })}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (active ? "border-gold bg-gold/15 text-gold-soft" : "border-border text-muted hover:border-gold/50 hover:text-gold-soft")
                }
              >
                {ISSUES[k].label}
              </Link>
            );
          })}
        </div>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>Name</Th>
            <Th>Category</Th>
            <Th>Location</Th>
            <Th>Missing</Th>
            <Th>Status</Th>
            <Th>Updated</Th>
          </tr>
        </Thead>
        <tbody>
          {places.map((p) => {
            const gaps = getMissing(p);
            return (
              <tr key={p.id} className="hover:bg-surface-raised/50">
                <Td>
                  <Link href={`/admin/places/${p.id}`} className="hover:text-gold-soft font-medium">{p.name}</Link>
                </Td>
                <Td>{CATEGORY_CONFIG[p.category].label}</Td>
                <Td className="text-muted">{[p.city?.name, p.country.name].filter(Boolean).join(", ")}</Td>
                <Td>
                  {gaps.length === 0 ? (
                    <span className="text-xs text-teal">Complete</span>
                  ) : (
                    <Link href={`/admin/places/${p.id}`} className="flex flex-wrap gap-1">
                      {gaps.map((g) => (
                        <span key={g} className="rounded bg-clay/15 px-1.5 py-0.5 text-[11px] text-clay">
                          {ISSUES[g].label}
                        </span>
                      ))}
                    </Link>
                  )}
                </Td>
                <Td><Badge tone={statusTone[p.status]}>{p.status.replace("_", " ")}</Badge></Td>
                <Td className="text-muted">{p.updatedAt.toLocaleDateString()}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {places.length === 0 && (
        <p className="text-sm text-muted">
          {filtered ? "No places match these filters." : "No places yet — add your first one to get started."}
        </p>
      )}
    </div>
  );
}