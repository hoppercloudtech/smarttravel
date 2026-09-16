import { prisma } from "@/lib/prisma";
import { Table, Thead, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_CONFIG } from "@/lib/categories";

export default async function DiscoveryPagesAdmin() {
    const pages = await prisma.discoveryPage.findMany({
        orderBy: { qualityScore: "desc" },
        take: 200,
        include: { country: true, city: true, landmark: true },
    });

    const statusTone = { INDEXABLE: "teal", DRAFT: "gold", RETIRED: "clay" } as const;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-display text-2xl">Discovery Pages</h1>
                <p className="text-sm text-muted mt-1">Programmatic location/proximity pages, materialized only where the quality gate passed.</p>
            </div>
            <Table>
                <Thead><tr><Th>Page</Th><Th>Type</Th><Th>Category</Th><Th>Places</Th><Th>Score</Th><Th>Status</Th></tr></Thead>
                <tbody>
                    {pages.map((p) => (
                        <tr key={p.id}>
                            <Td><a href={`/discover/${p.slug}`} target="_blank" className="hover:text-gold-soft">{p.title.split(" | ")[0]}</a></Td>
                            <Td>{p.pageType}</Td>
                            <Td>{CATEGORY_CONFIG[p.category].label}</Td>
                            <Td>{p.placeCount}</Td>
                            <Td>{p.qualityScore}</Td>
                            <Td><Badge tone={statusTone[p.status]}>{p.status}</Badge></Td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
}