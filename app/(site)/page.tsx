import type { PlaceCategory } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PlaceCard, type PlaceCardData } from "@/components/site/place-card";
import { SearchBar } from "@/components/site/search-bar";
import { CATEGORY_CONFIG } from "@/lib/categories";

export const revalidate = 3600;

async function getFeaturedPlaces(): Promise<PlaceCardData[]> {
  const places = await prisma.place.findMany({
    where: { status: "PUBLISHED", featured: true },
    take: 8,
    include: {
      country: true,
      city: true,
      media: {
        where: { isHero: true },
        take: 1,
      },
      summaries: {
        where: { isCurrent: true },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return places.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    cityName: p.city?.name,
    countryName: p.country.name,
    heroImageUrl: p.media[0]?.url,
    summarySnippet: p.summaries[0]?.content?.slice(0, 110),
  }));
}


async function getCategoryPlaces(
  category: PlaceCategory
): Promise<PlaceCardData[]> {
  const places = await prisma.place.findMany({
    where: {
      status: "PUBLISHED",
      category,
    },
    take: 4,
    include: {
      country: true,
      city: true,
      media: {
        where: { isHero: true },
        take: 1,
      },
      summaries: {
        where: { isCurrent: true },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return places.map((p) => ({
    slug: p.slug,
    name: p.name,
    category: p.category,
    cityName: p.city?.name,
    countryName: p.country.name,
    heroImageUrl: p.media[0]?.url,
    summarySnippet: p.summaries[0]?.content?.slice(0, 110),
  }));
}


export default async function HomePage() {
  const featured = await getFeaturedPlaces();

  const categorySections = await Promise.all(
    Object.entries(CATEGORY_CONFIG).map(async ([category, config]) => ({
      config,
      places: await getCategoryPlaces(category as PlaceCategory),
    }))
  );


  return (
    <main>
      <section className="container pt-20 pb-14">
        <div className="max-w-3xl">

          {/* <p className="text-sm uppercase tracking-widest text-gold-soft mb-4">
            Uganda · Kenya · Tanzania · Rwanda
          </p> */}

          <h1 className="font-display text-5xl md:text-6xl leading-tight mb-6">
            Every place worth finding in East Africa
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed">
            Hotels, restaurants, stays and attractions — with original overviews,
            real locations, and the places nearby worth knowing about.
          </p>

        </div>
      </section>

      {/* KEEP YOUR EXISTING HERO SECTION HERE */}
      <section className="container py-8">
        <div className="mx-auto w-full max-w-3xl">
          <SearchBar />
        </div>
      </section>


      <section className="container py-14">
        <div className="flex flex-wrap gap-3">
          {Object.values(CATEGORY_CONFIG).map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:border-gold/50 hover:text-gold-soft transition-colors"
            >
              {c.pluralLabel}
            </Link>
          ))}
        </div>
      </section>


      {/* FEATURED SECTION */}
      {featured.length > 0 && (
        <section className="container pb-24">

          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-display text-2xl">
              Featured this week
            </h2>
          </div>

          <div className="route-divider mb-8" />


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featured.map((p) => (
              <PlaceCard
                key={p.slug}
                place={p}
              />
            ))}
          </div>

        </section>
      )}



      {/* CATEGORY SECTIONS */}
      {categorySections.map(({ config, places }) =>
        places.length > 0 ? (
          <section
            key={config.slug}
            className="container pb-24"
          >

            <div className="flex items-center justify-between mb-6">

              <h2 className="font-display text-2xl">
                {config.pluralLabel}
              </h2>


              <Link
                href={`/${config.slug}`}
                className="
    inline-flex items-center justify-center
    rounded-full
    border border-gold/40
    bg-surface
    px-5 py-2
    text-sm font-medium
    text-gold-soft
    shadow-sm
    transition-all
    hover:bg-gold
    hover:text-black
    hover:border-gold
    hover:shadow-lg
  "
              >
                View All →
              </Link>

            </div>


            <div className="route-divider mb-8" />


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

              {places.map((place) => (
                <PlaceCard
                  key={place.slug}
                  place={place}
                />
              ))}

            </div>

          </section>
        ) : null
      )}

    </main>
  );
}