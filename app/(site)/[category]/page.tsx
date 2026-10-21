import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categoryFromUrlSlug, CATEGORY_CONFIG } from "@/lib/categories";
import { PlaceCard } from "@/components/site/place-card";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { getVisitorCountrySlug } from "@/lib/visitorCountry";
import { getPlacesCountryFirst } from "@/lib/places/countryFirst";

// No `revalidate` export: reading the visitor's country makes this page
// dynamic. The data itself is still cached for 1 hour per country.

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

  const cards = await getPlacesCountryFirst({
    countrySlug: getVisitorCountrySlug(),
    category,
    take: 60,
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
  });

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