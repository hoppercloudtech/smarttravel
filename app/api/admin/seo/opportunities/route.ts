import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const opportunities = await prisma.seoInsight.findMany({
        where: { kind: "OPPORTUNITY" },
        orderBy: { score: "desc" },
        take: 200,
    });

    const countryIds = [...new Set(opportunities.map((o) => o.countryId).filter(Boolean))] as string[];
    const cityIds = [...new Set(opportunities.map((o) => o.cityId).filter(Boolean))] as string[];
    const [countries, cities] = await Promise.all([
        prisma.country.findMany({ where: { id: { in: countryIds } } }),
        prisma.city.findMany({ where: { id: { in: cityIds } } }),
    ]);
    const countryMap = new Map(countries.map((c) => [c.id, c.name]));
    const cityMap = new Map(cities.map((c) => [c.id, c.name]));

    const enriched = opportunities.map((o) => ({
        ...o,
        countryName: o.countryId ? countryMap.get(o.countryId) : null,
        cityName: o.cityId ? cityMap.get(o.cityId) : null,
    }));

    return NextResponse.json({ opportunities: enriched });
}