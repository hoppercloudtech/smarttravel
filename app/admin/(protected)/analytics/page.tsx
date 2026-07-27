import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, Thead, Th, Td } from "@/components/ui/table";

export default async function AnalyticsPage() {
  const [topSearches, topViewed, aiByModel, imageGaps] = await Promise.all([
    prisma.searchQueryLog.groupBy({
      by: ["query"],
      _count: true,
      orderBy: { _count: { query: "desc" } },
      take: 10,
    }),
    prisma.pageViewLog.groupBy({
      by: ["placeId"],
      _count: true,
      orderBy: { _count: { placeId: "desc" } },
      take: 10,
    }),
    prisma.aISummary.groupBy({
      by: ["model"],
      _sum: { estCostUsd: true, promptTokens: true, outputTokens: true },
      _count: true,
    }),
    prisma.place.count({ where: { imageStatus: { in: ["PENDING", "NONE_AVAILABLE"] }, status: "PUBLISHED" } }),
  ]);

  const placeIds = topViewed.map((v) => v.placeId);
  const places = await prisma.place.findMany({ where: { id: { in: placeIds } } });
  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl">Analytics</h1>
        <p className="text-sm text-muted mt-1">Search behavior, page popularity, and AI cost — all sourced from SmartTravel's own logs.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Most searched queries</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead><tr><Th>Query</Th><Th>Count</Th></tr></Thead>
              <tbody>
                {topSearches.map((s) => (
                  <tr key={s.query}><Td>{s.query}</Td><Td>{s._count}</Td></tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Most viewed places</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <Thead><tr><Th>Place</Th><Th>Views</Th></tr></Thead>
              <tbody>
                {topViewed.map((v) => (
                  <tr key={v.placeId}><Td>{placeName(v.placeId)}</Td><Td>{v._count}</Td></tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>AI usage by model</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <Thead><tr><Th>Model</Th><Th>Summaries</Th><Th>Input tokens</Th><Th>Output tokens</Th><Th>Est. cost</Th></tr></Thead>
            <tbody>
              {aiByModel.map((m) => (
                <tr key={m.model}>
                  <Td>{m.model}</Td>
                  <Td>{m._count}</Td>
                  <Td>{m._sum.promptTokens?.toLocaleString()}</Td>
                  <Td>{m._sum.outputTokens?.toLocaleString()}</Td>
                  <Td>${(m._sum.estCostUsd ?? 0).toFixed(2)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Content health</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            <span className="text-clay font-medium">{imageGaps}</span> published places are missing approved photos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
