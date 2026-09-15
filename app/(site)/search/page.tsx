import { prisma } from "@/lib/prisma";
import { searchPlaces } from "@/lib/search";
import { searchPlacesWithFallback } from "@/lib/places/placeService";
import { PlaceCard } from "@/components/site/place-card";
// import { GoogleResultCard } from "@/components/site/google-result-card";
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

  // Google fallback ONLY fires when the database genuinely has nothing —
  // never runs alongside local results, never runs on every keystroke (this
  // page loads once per submitted search, not per autocomplete request).
  const providerFallback = q && places.length === 0 ? await searchPlacesWithFallback(q, "UG") : null;

  return (
    <div className="container py-8">
      <h1 className="font-display text-2xl mb-1">Search results</h1>
      <p className="text-sm text-muted mb-8">
        {places.length} result{places.length === 1 ? "" : "s"} for "{q}"
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
        <div className="mt-2">
          <p className="text-sm text-muted mb-4">
            Nothing on HorizonSpot yet for "{q}" — try a broader term, or browse by{" "}
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

          {providerFallback && providerFallback.results.length > 0 && (
            <div className="space-y-3 mt-6">
              <p className="text-xs uppercase tracking-wide text-muted">
                Found via{" "}
                {providerFallback.providerUsed === "google"
                  ? "Google Maps"
                  : "our discovery partner"}
              </p>

              {providerFallback.results.map((place) => (
                <div
                  key={place.id}
                  className="rounded-lg border border-dashed border-border bg-surface/50 p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-muted mb-1">
                    Not yet on HorizonSpot
                  </p>

                  <h3 className="font-medium text-sm">{place.name}</h3>

                  {place.address && (
                    <p className="text-xs text-muted mt-0.5">{place.address}</p>
                  )}

                  <p className="text-[11px] text-muted mt-2">
                    {place.attributionText}
                  </p>

                  {place.mapsUri && (
                    <a
                      href={place.mapsUri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gold-soft hover:underline"
                    >
                      View on Google Maps
                    </a>
                  )}
                </div>
              ))}

              <p className="text-xs text-muted">
                These places aren't on HorizonSpot yet — our team reviews new discoveries
                before adding them.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}