import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { PlaceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { PlaceCard } from "@/components/site/place-card";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { getCountryPlaces } from "@/lib/places/countryFirst";

export const revalidate = 21600;

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const country = await prisma.country.findUnique({ where: { slug: params.slug } });
    if (!country) return {};
    return {
        title: `Hotels, restaurants and attractions in ${country.name}`,
        description: `Explore hotels, resorts, restaurants, stays and attractions in ${country.name}, with original overviews, photos and locations.`,
        alternates: { canonical: `/country/${country.slug}` },
    };
}

export default async function CountryPage({ params }: Props) {
    const country = await prisma.country.findUnique({ where: { slug: params.slug } });
    if (!country) notFound();

    const sections = await Promise.all(
        Object.entries(CATEGORY_CONFIG).map(async ([category, config]) => ({
            config,
            places: await getCountryPlaces({
                countryId: country.id,
                category: category as PlaceCategory,
                take: 8,
            }),
        }))
    );

    const hasAny = sections.some((s) => s.places.length > 0);

    return (
        <div className="container py-8">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: country.name }]} />
            <h1 className="font-display text-3xl mb-10">Places in {country.name}</h1>

            {!hasAny && (
                <p className="text-muted text-sm">
                    No places published in {country.name} yet. New places are added continuously.
                </p>
            )}

            {sections.map(({ config, places }) =>
                places.length > 0 ? (
                    <section key={config.slug} className="pb-16">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-display text-2xl">{config.pluralLabel}</h2>
                            <Link
                                href={`/country/${country.slug}/${config.slug}`}
                                className="inline-flex items-center rounded-full border border-gold/40 bg-surface px-5 py-2 text-sm font-medium text-gold-soft transition-all hover:bg-gold hover:text-black hover:border-gold"
                            >
                                View All →
                            </Link>
                        </div>
                        <div className="route-divider mb-8" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {places.map((p) => (
                                <PlaceCard key={p.slug} place={p} />
                            ))}
                        </div>
                    </section>
                ) : null
            )}
        </div>
    );
}