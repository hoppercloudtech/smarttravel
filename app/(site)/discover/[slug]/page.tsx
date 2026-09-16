import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlaceCard, type PlaceCardData } from "@/components/site/place-card";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { CATEGORY_CONFIG } from "@/lib/categories";

export const revalidate = 21600; // 6h — same cadence as your existing category listing pages

async function getDiscoveryPageData(slug: string) {
    const page = await prisma.discoveryPage.findUnique({
        where: { slug },
        include: { country: true, city: true, landmark: { include: { country: true, city: true } } },
    });
    if (!page || page.status !== "INDEXABLE") return null;

    const places = await prisma.place.findMany({
        where: {
            status: "PUBLISHED",
            category: page.category,
            ...(page.pageType === "LOCATION_CATEGORY" ? { countryId: page.countryId ?? undefined, cityId: page.cityId ?? undefined } : {}),
        },
        include: { country: true, city: true, media: { where: { isHero: true }, take: 1 }, discoveryScore: true },
        take: 60,
    });

    // PROXIMITY needs a distance filter the DB query above can't express cleanly — filter in memory, dataset is small per page.
    const filtered =
        page.pageType === "PROXIMITY" && page.landmark
            ? places.filter((p) => {
                if (p.latitude == null || p.longitude == null) return false;
                const R = 6371;
                const dLat = ((p.latitude - page.landmark!.latitude) * Math.PI) / 180;
                const dLon = ((p.longitude - page.landmark!.longitude) * Math.PI) / 180;
                const a = Math.sin(dLat / 2) ** 2 + Math.cos((page.landmark!.latitude * Math.PI) / 180) * Math.cos((p.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
                const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return km <= page.landmark!.radiusKm;
            })
            : places;

    const sorted = filtered.sort((a, b) => (b.discoveryScore?.horizonScore ?? 0) - (a.discoveryScore?.horizonScore ?? 0));

    return { page, places: sorted };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const data = await getDiscoveryPageData(params.slug);
    if (!data) return {};
    return {
        title: data.page.title,
        description: data.page.description,
        alternates: { canonical: `/discover/${data.page.slug}` },
    };
}

export default async function DiscoveryPage({ params }: { params: { slug: string } }) {
    const data = await getDiscoveryPageData(params.slug);
    if (!data) notFound();
    const { page, places } = data;

    const locationLabel = page.pageType === "LOCATION_CATEGORY" ? (page.city?.name ?? page.country?.name ?? "") : page.landmark?.name ?? "";

    const cards: PlaceCardData[] = places.map((p) => ({
        slug: p.slug,
        name: p.name,
        category: p.category,
        cityName: p.city?.name,
        countryName: p.country.name,
        heroImageUrl: p.media[0]?.url,
    }));

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: places.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${process.env.NEXT_PUBLIC_SITE_URL}/${CATEGORY_CONFIG[p.category].slug}/${p.slug}` })),
    };

    return (
        <div className="container py-8">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: CATEGORY_CONFIG[page.category].pluralLabel, href: `/${CATEGORY_CONFIG[page.category].slug}` }, { label: locationLabel }]} />
            <h1 className="font-display text-3xl mb-3">{page.title.split(" | ")[0]}</h1>
            <p className="text-sm text-muted mb-8 max-w-2xl">{page.description}</p>

            <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
                {cards.map((c) => <PlaceCard key={c.slug} place={c} />)}
            </div>

            {cards.length === 0 && <p className="text-sm text-muted">Nothing matches right now — check back soon.</p>}
        </div>
    );
}