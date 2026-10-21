import { unstable_cache } from "next/cache";
import type { Prisma, PlaceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PlaceCardData } from "@/components/site/place-card";

export const placeInclude = {
    country: true,
    city: true,
    media: { where: { isHero: true }, take: 1 },
    summaries: { where: { isCurrent: true }, take: 1 },
} satisfies Prisma.PlaceInclude;

type PlaceWithRelations = Prisma.PlaceGetPayload<{ include: typeof placeInclude }>;

export function toCard(p: PlaceWithRelations): PlaceCardData {
    return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        cityName: p.city?.name,
        countryName: p.country.name,
        heroImageUrl: p.media[0]?.url,
        summarySnippet: p.summaries[0]?.content?.slice(0, 110),
    };
}

type CountryFirstOptions = {
    countrySlug: string | null;
    category?: PlaceCategory;
    featuredOnly?: boolean;
    take: number;
    orderBy: Prisma.PlaceOrderByWithRelationInput[];
};

async function queryCountryFirst(opts: CountryFirstOptions): Promise<PlaceCardData[]> {
    const base: Prisma.PlaceWhereInput = {
        status: "PUBLISHED",
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.featuredOnly ? { featured: true } : {}),
    };

    let results: PlaceWithRelations[] = [];

    // 1. Visitor's country first
    if (opts.countrySlug) {
        results = await prisma.place.findMany({
            where: { ...base, country: { slug: opts.countrySlug } },
            include: placeInclude,
            orderBy: opts.orderBy,
            take: opts.take,
        });
    }

    // 2. Fill remaining slots with other countries (also the full fallback
    //    when the visitor's country has no places or can't be detected)
    if (results.length < opts.take) {
        const rest = await prisma.place.findMany({
            where: { ...base, id: { notIn: results.map((r) => r.id) } },
            include: placeInclude,
            orderBy: opts.orderBy,
            take: opts.take - results.length,
        });
        results = [...results, ...rest];
    }

    return results.map(toCard);
}

// Cached per unique options (so per country + category). Refreshes hourly.
export const getPlacesCountryFirst = unstable_cache(
    queryCountryFirst,
    ["places-country-first"],
    { revalidate: 3600 }
);

/** Places from ONE country only, nothing from other countries. */
export async function getCountryPlaces(opts: {
    countryId: string;
    category: PlaceCategory;
    take: number;
}): Promise<PlaceCardData[]> {
    const places = await prisma.place.findMany({
        where: { status: "PUBLISHED", countryId: opts.countryId, category: opts.category },
        include: placeInclude,
        orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
        take: opts.take,
    });
    return places.map(toCard);
}