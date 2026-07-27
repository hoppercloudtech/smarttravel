import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categoryFromUrlSlug, CATEGORY_CONFIG } from "@/lib/categories";
import { PlaceCard, type PlaceCardData } from "@/components/site/place-card";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

export const revalidate = 21600; // 6h — listings change more often than individual place pages

type Props = { params: { category: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = categoryFromUrlSlug(params.category);
  if (!category) return {};
  const config = CATEGORY_CONFIG[category];
  return {
    title: `${config.pluralLabel} in East Africa`,
    description: `Browse ${config.pluralLabel.toLowerCase()} across Uganda, Kenya, Tanzania, Rwanda and beyond, with original overviews, photos and locations.`,
    alternates: { canonical: `/${config.slug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const category = categoryFromUrlSlug(params.category);
  if (!category) notFound();
  const config = CATEGORY_CONFIG[category];

  const places = await prisma.place.findMany({
    where: { status: "PUBLISHED", category },
    include: {
      country: true,
      city: true,
      media: { where: { isHero: true }, take: 1 },
      summaries: { where: { isCurrent: true }, take: 1 },
    },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: 60,
  });

  const cards: PlaceCardData[] = places.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    cityName: p.city?.name,
    countryName: p.country.name,
    heroImageUrl: p.media[0]?.url,
    summarySnippet: p.summaries[0]?.content?.slice(0, 110),
  }));

  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: config.pluralLabel }]} />
      <h1 className="font-display text-3xl mb-8">{config.pluralLabel} in East Africa</h1>

      {cards.length === 0 ? (
        <p className="text-muted text-sm">
          No {config.pluralLabel.toLowerCase()} published yet — new places are added continuously as our
          ingestion pipeline covers more of East Africa.
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
