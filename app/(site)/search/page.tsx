import { prisma } from "@/lib/prisma";
import { searchPlaces } from "@/lib/search";
import { PlaceCard } from "@/components/site/place-card";
import { CATEGORY_CONFIG } from "@/lib/categories";
import type { PlaceCategory } from "@prisma/client";

export const dynamic = "force-dynamic"; // search results are inherently query-dependent

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? "";
  const hits = q ? await searchPlaces(q, 30) : [];

  const places =
    hits.length > 0
      ? await prisma.place.findMany({
          where: { id: { in: hits.map((h) => h.id) } },
          include: {
            country: true,
            city: true,
            media: { where: { isHero: true }, take: 1 },
          },
        })
      : [];

  return (
    <div className="container py-8">
      <h1 className="font-display text-2xl mb-1">Search results</h1>
      <p className="text-sm text-muted mb-8">
        {places.length} result{places.length === 1 ? "" : "s"} for “{q}”
      </p>

      <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
        {places.map((p) => (
          <PlaceCard
            key={p.slug}
            place={{
              slug: p.slug,
              name: p.name,
              category: p.category as PlaceCategory,
              cityName: p.city?.name,
              countryName: p.country.name,
              heroImageUrl: p.media[0]?.url,
            }}
          />
        ))}
      </div>

      {places.length === 0 && q && (
        <p className="text-sm text-muted">
          No matches yet — try a broader term, or browse by{" "}
          {Object.values(CATEGORY_CONFIG).map((c, i) => (
            <span key={c.slug}>
              {i > 0 && ", "}
              <a href={`/${c.slug}`} className="text-gold-soft hover:underline">
                {c.pluralLabel.toLowerCase()}
              </a>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}
