import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categoryFromUrlSlug, CATEGORY_CONFIG } from "@/lib/categories";
import { PlaceCard } from "@/components/site/place-card";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { getCountryPlaces } from "@/lib/places/countryFirst";

export const revalidate = 21600;

type Props = { params: { slug: string; category: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const category = categoryFromUrlSlug(params.category);
    const country = await prisma.country.findUnique({ where: { slug: params.slug } });
    if (!category || !country) return {};
    const config = CATEGORY_CONFIG[category];
    return {
        title: `${config.pluralLabel} in ${country.name}`,
        description: `Browse ${config.pluralLabel.toLowerCase()} in ${country.name}, with original overviews, photos and locations.`,
        alternates: { canonical: `/country/${country.slug}/${config.slug}` },
    };
}

export default async function CountryCategoryPage({ params }: Props) {
    const category = categoryFromUrlSlug(params.category);
    const country = await prisma.country.findUnique({ where: { slug: params.slug } });
    if (!category || !country) notFound();
    const config = CATEGORY_CONFIG[category];

    const cards = await getCountryPlaces({ countryId: country.id, category, take: 60 });

    return (
        <div className="container py-8">
            <Breadcrumbs
                items={[
                    { label: "Home", href: "/" },
                    { label: country.name, href: `/country/${country.slug}` },
                    { label: config.pluralLabel },
                ]}
            />
            <h1 className="font-display text-3xl mb-8">
                {config.pluralLabel} in {country.name}
            </h1>

            {cards.length === 0 ? (
                <p className="text-muted text-sm">
                    No {config.pluralLabel.toLowerCase()} published in {country.name} yet.
                </p>
            ) : (
                <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
                    {cards.map((p) => (
                        <PlaceCard key={p.slug} place={p} />
                    ))}
                </div>
            )}
        </div>
    );
}