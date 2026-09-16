import { prisma } from "@/lib/prisma";
import { SeoRecomputeButton } from "@/components/admin/seo-recompute-button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, Thead, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_CONFIG } from "@/lib/categories";

export default async function SeoOverviewPage() {
    const [opportunities, weakHealth] = await Promise.all([
        prisma.seoInsight.findMany({ where: { kind: "OPPORTUNITY" }, orderBy: { score: "desc" }, take: 30 }),
        prisma.seoInsight.findMany({
            where: { kind: "HEALTH_CHECK", score: { lt: 70 } },
            orderBy: { score: "asc" },
            take: 30,
            include: { place: { select: { name: true, slug: true, category: true } } },
        }),
    ]);

    const countryIds = [...new Set(opportunities.map((o) => o.countryId).filter(Boolean))] as string[];
    const cityIds = [...new Set(opportunities.map((o) => o.cityId).filter(Boolean))] as string[];
    const [countries, cities] = await Promise.all([
        prisma.country.findMany({ where: { id: { in: countryIds } } }),
        prisma.city.findMany({ where: { id: { in: cityIds } } }),
    ]);
    const countryMap = new Map(countries.map((c) => [c.id, c.name]));
    const cityMap = new Map(cities.map((c) => [c.id, c.name]));

    const recTone = { CREATE: "teal", OPTIMIZE: "gold", MONITOR: "muted", DO_NOT_CREATE: "clay" } as const;

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-2xl">SEO Intelligence</h1>
                    <p className="text-sm text-muted mt-1">
                        Where to spend SEO effort today — computed from real place data on a schedule, never live per-request.
                    </p>
                </div>
                <SeoRecomputeButton />
            </div>

            <Card>
                <CardHeader><CardTitle>Location × category opportunities</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <Thead><tr><Th>Location</Th><Th>Category</Th><Th>Places</Th><Th>Score</Th><Th>Recommendation</Th></tr></Thead>
                        <tbody>
                            {opportunities.map((o) => (
                                <tr key={o.id}>
                                    <Td>
                                        {o.cityId ? cityMap.get(o.cityId) : countryMap.get(o.countryId ?? "")}
                                        {o.cityId ? `, ${countryMap.get(o.countryId ?? "")}` : ""}
                                    </Td>
                                    <Td>{o.category ? CATEGORY_CONFIG[o.category].pluralLabel : "—"}</Td>
                                    <Td>{o.placeCount}</Td>
                                    <Td>{o.score}</Td>
                                    <Td><Badge tone={recTone[o.recommendation as keyof typeof recTone] ?? "muted"}>{o.recommendation}</Badge></Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    {opportunities.length === 0 && <p className="text-sm text-muted p-4">No opportunities computed yet — click "Recompute now" above.</p>}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Places needing SEO attention (health &lt; 70)</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <Thead><tr><Th>Place</Th><Th>Category</Th><Th>Health score</Th></tr></Thead>
                        <tbody>
                            {weakHealth.map((h) => (
                                <tr key={h.id}>
                                    <Td><a href={`/admin/places/${h.placeId}`} className="hover:text-gold-soft">{h.place?.name}</a></Td>
                                    <Td>{h.place ? CATEGORY_CONFIG[h.place.category].label : "—"}</Td>
                                    <Td>{h.score}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                    {weakHealth.length === 0 && <p className="text-sm text-muted p-4">No health checks below 70 yet.</p>}
                </CardContent>
            </Card>
        </div>
    );
}