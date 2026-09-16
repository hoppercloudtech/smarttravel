import { prisma } from "@/lib/prisma";
import { Table, Thead, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function SearchConsoleAdmin() {
    const account = await prisma.searchConsoleAccount.findFirst();
    const opportunities = account ? await prisma.ctrOpportunity.findMany({ where: { resolved: false }, orderBy: { detectedAt: "desc" }, take: 50 }) : [];

    const categoryTone = { SNIPPET_PROBLEM: "gold", RANKING_PROBLEM: "clay", RANKING_OPPORTUNITY: "teal", QUERY_MISMATCH: "muted" } as const;

    return (
        <div className="space-y-6">
            <h1 className="font-display text-2xl">Search Console</h1>

            {!account ? (
                <div className="space-y-3">
                    <p className="text-sm text-muted">Not connected yet — CTR opportunities and experiments need this to have real data.</p>
                    <a href="/api/admin/search-console/connect"><Button>Connect Search Console</Button></a>
                </div>
            ) : (
                <>
                    <p className="text-sm text-muted">{account.siteUrl} · Last synced: {account.lastSyncedAt?.toLocaleString() ?? "never"}</p>
                    <Table>
                        <Thead><tr><Th>Page</Th><Th>Query</Th><Th>Impressions</Th><Th>CTR</Th><Th>Position</Th><Th>Issue</Th></tr></Thead>
                        <tbody>
                            {opportunities.map((o) => (
                                <tr key={o.id}>
                                    <Td className="max-w-xs truncate">{o.page}</Td>
                                    <Td>{o.query}</Td>
                                    <Td>{o.impressions.toLocaleString()}</Td>
                                    <Td>{(o.ctr * 100).toFixed(2)}%</Td>
                                    <Td>{o.averagePosition.toFixed(1)}</Td>
                                    <Td><Badge tone={categoryTone[o.category]}>{o.category.replace(/_/g, " ")}</Badge></Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    {opportunities.length === 0 && <p className="text-sm text-muted">No opportunities detected yet.</p>}
                </>
            )}
        </div>
    );
}