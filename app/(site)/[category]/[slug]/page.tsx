import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Globe, Phone, Mail, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { categoryFromUrlSlug, CATEGORY_CONFIG } from "@/lib/categories";
import { buildSeoTitle, buildSeoDescription, buildPlaceJsonLd, canonicalPathFor } from "@/lib/seo";
import { ImageGallery } from "@/components/site/image-gallery";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { FaqSection } from "@/components/site/faq";
import { MapEmbed } from "@/components/site/map-embed";
import { PlaceCard, type PlaceCardData } from "@/components/site/place-card";
import { Badge } from "@/components/ui/badge";
import { getRelatedPlaces } from "@/lib/places/relatedPlaces";
import { RelatedPlacesSection } from "@/components/site/related-places-section";
import { getIntentTransitions } from "@/lib/discovery/internalLinking";
import { VideoHero } from "@/components/site/video-hero";
import { PhotoCarousel } from "@/components/site/photo-carousel";
// ISR: pages are served statically and refreshed at most every 24h, but the
// ingestion pipeline and admin edits call revalidatePath() for immediate
// freshness on create/update — see jobs/ingest.ts and the admin place actions.
// The YouTube cron also revalidates a page as soon as it saves videos for it.
export const revalidate = 86400;
export const dynamicParams = true; // allow on-demand generation for places not yet statically built

type Props = { params: { category: string; slug: string } };

async function getPlace(categorySlug: string, slug: string) {
  const category = categoryFromUrlSlug(categorySlug);
  if (!category) return null;

  const place = await prisma.place.findFirst({
    where: { slug, category, status: "PUBLISHED" },
    include: {
      country: true,
      city: true,
      media: { orderBy: { order: "asc" } },
      // Saved videos only — this page never calls the YouTube API.
      videos: { orderBy: { order: "asc" } },
      summaries: { where: { isCurrent: true }, take: 1 },
      faqs: { orderBy: { order: "asc" } },
      nearbyFrom: {
        include: {
          toPlace: {
            include: {
              country: true,
              city: true,
              media: { where: { isHero: true }, take: 1 },
              videos: { orderBy: { order: "asc" }, take: 1 },
            },
          },
        },
        orderBy: { rank: "asc" },
        take: 6,
      },
    },
  });

  return place;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await getPlace(params.category, params.slug);
  if (!place) return {};

  const title = buildSeoTitle(place);
  const description = buildSeoDescription(place);
  const canonicalPath = canonicalPathFor(place);
  const heroImage = place.media[0]?.url ?? place.videos[0]?.thumbnailUrl;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website",
      images: heroImage ? [{ url: heroImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: heroImage ? [heroImage] : undefined,
    },
  };
}

export default async function PlacePage({ params }: Props) {
  const place = await getPlace(params.category, params.slug);
  if (!place) notFound();

  const config = CATEGORY_CONFIG[place.category];
  const summary = place.summaries[0]?.content;
  const jsonLd = buildPlaceJsonLd(place);

  const videos = place.videos.map((v) => ({ videoId: v.videoId, title: v.title, thumbnailUrl: v.thumbnailUrl }));
  const photos = place.media.map((m) => ({
    url: m.url,
    altText: m.altText,
    license: m.license,
    sourceUrl: m.sourceUrl,
  }));

  const nearby: PlaceCardData[] = place.nearbyFrom.map((rel) => ({
    slug: rel.toPlace.slug,
    name: rel.toPlace.name,
    category: rel.toPlace.category,
    cityName: rel.toPlace.city?.name,
    countryName: rel.toPlace.country.name,
    heroImageUrl: rel.toPlace.media[0]?.url,
    videoThumbnailUrl: rel.toPlace.videos[0]?.thumbnailUrl,
  }));

  const relatedPlaces = await getRelatedPlaces({
    id: place.id,
    category: place.category,
    countryId: place.countryId,
    cityId: place.cityId,
    district: place.district,
    latitude: place.latitude,
    longitude: place.longitude,
  });
  const intentTransitions = await getIntentTransitions(place.id);

  // fire-and-forget view logging — never blocks the render
  prisma.pageViewLog.create({ data: { placeId: place.id } }).catch(() => { });

  return (
    <article className="container py-6 sm:py-8 max-w-5xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.place) }} />
      {jsonLd.faq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.faq) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd.breadcrumb) }} />

      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: config.pluralLabel, href: `/${config.slug}` },
          { label: place.name },
        ]}
      />

      <header className="mb-5 sm:mb-6">
        <Badge tone="gold" className="mb-3">{config.label}</Badge>
        <h1 className="font-display text-2xl sm:text-4xl leading-tight text-balance">{place.name}</h1>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{[place.address, place.city?.name, place.country.name].filter(Boolean).join(", ")}</span>
        </p>
      </header>

      {/* Video first (main video + more videos below); photo gallery when no saved video exists */}
      {videos.length > 0 ? (
        <VideoHero videos={videos} placeName={place.name} />
      ) : (
        <ImageGallery images={place.media} placeName={place.name} />
      )}

      <div className="mt-8 sm:mt-10 grid gap-8 sm:gap-10 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 space-y-8 sm:space-y-10">
          {summary && (
            <section>
              <h2 className="font-display text-2xl mb-3">Overview</h2>
              <p className="text-muted leading-relaxed whitespace-pre-line">{summary}</p>
            </section>
          )}

          {place.amenities && Array.isArray(place.amenities) && place.amenities.length > 0 && (
            <section>
              <h2 className="font-display text-2xl mb-3">Amenities</h2>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(place.amenities as string[]).map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 className="h-4 w-4 text-teal shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {place.roomTypes && Array.isArray(place.roomTypes) && place.roomTypes.length > 0 && (
            <section>
              <h2 className="font-display text-2xl mb-3">Room types</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {(place.roomTypes as { name: string; notes?: string }[]).map((r) => (
                  <div key={r.name} className="rounded-md border border-border bg-surface p-4">
                    <div className="font-medium text-sm">{r.name}</div>
                    {r.notes && <div className="text-xs text-muted mt-1">{r.notes}</div>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Photo cards. When there is no video the photos are already in the hero gallery,
              so they are not repeated here. */}
          {videos.length > 0 && photos.length > 0 && <PhotoCarousel photos={photos} placeName={place.name} />}

          {place.latitude != null && place.longitude != null && (
            <section>
              <h2 className="font-display text-2xl mb-3">Location</h2>
              <MapEmbed latitude={place.latitude} longitude={place.longitude} name={place.name} />
            </section>
          )}

          <FaqSection items={place.faqs.map((f) => ({ question: f.question, answer: f.answer }))} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-3 text-sm">
            <h2 className="font-display text-lg">Contact</h2>
            {place.phone && (
              <a href={`tel:${place.phone}`} className="flex items-center gap-2 hover:text-gold-soft">
                <Phone className="h-4 w-4 text-muted" /> {place.phone}
              </a>
            )}
            {place.email && (
              <a href={`mailto:${place.email}`} className="flex items-center gap-2 hover:text-gold-soft break-all">
                <Mail className="h-4 w-4 text-muted" /> {place.email}
              </a>
            )}
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-gold-soft break-all">
                <Globe className="h-4 w-4 text-muted" /> Visit website
              </a>
            )}
            {place.googleMapsUrl && (
              <a href={place.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-gold-soft">
                <MapPin className="h-4 w-4 text-muted" /> Open in Google Maps
              </a>
            )}
          </div>
        </aside>
      </div>

      {nearby.length > 0 && (
        <section className="mt-12 sm:mt-16">
          <h2 className="font-display text-2xl mb-4 sm:mb-6">Nearby</h2>
          <div className="grid gap-4 sm:gap-6 grid-cols-2 md:grid-cols-3">
            {nearby.map((p) => (
              <PlaceCard key={p.slug} place={p} />
            ))}
          </div>
        </section>
      )}

      {intentTransitions.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl mb-4">Continue exploring</h2>
          <div className="flex flex-wrap gap-2">
            {intentTransitions.map((t) => (
              <a key={t.href} href={t.href} className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-gold/50 hover:text-gold-soft transition-colors">
                {t.label}
              </a>
            ))}
          </div>
        </section>
      )}

      <RelatedPlacesSection places={relatedPlaces} />
    </article>
  );
}