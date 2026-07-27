import type { Place, PlaceMedia, Country, City, AISummary, PlaceFAQ } from "@prisma/client";
import { CATEGORY_CONFIG } from "@/lib/categories";

type FullPlace = Place & {
  country: Country;
  city: City | null;
  media: PlaceMedia[];
  summaries: AISummary[];
  faqs: PlaceFAQ[];
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://smarttravel.africa";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "SmartTravel";

export function canonicalPathFor(place: Pick<Place, "category" | "slug">) {
  return `/${CATEGORY_CONFIG[place.category].slug}/${place.slug}`;
}

export function buildSeoTitle(place: FullPlace) {
  const loc = place.city?.name ?? place.country.name;
  return `${place.name} — ${CATEGORY_CONFIG[place.category].label} in ${loc} | ${SITE_NAME}`;
}

export function buildSeoDescription(place: FullPlace) {
  const summary = place.summaries.find((s) => s.isCurrent)?.content;
  if (summary) return summary.slice(0, 155).trim() + (summary.length > 155 ? "…" : "");
  const loc = place.city?.name ?? place.country.name;
  return `${place.name} is a ${CATEGORY_CONFIG[place.category].label.toLowerCase()} in ${loc}, ${place.country.name}. See photos, amenities, location and more on ${SITE_NAME}.`;
}

/**
 * Builds Schema.org JSON-LD from the place record at render time, so
 * structured data can never drift out of sync with the visible page content.
 */
export function buildPlaceJsonLd(place: FullPlace) {
  const config = CATEGORY_CONFIG[place.category];
  const url = `${SITE_URL}${canonicalPathFor(place)}`;
  const images = place.media.sort((a, b) => a.order - b.order).map((m) => m.url);

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": config.schemaType,
    name: place.name,
    url,
    image: images.length ? images : undefined,
    address: place.address
      ? {
          "@type": "PostalAddress",
          streetAddress: place.address,
          addressLocality: place.city?.name,
          addressRegion: place.district ?? undefined,
          addressCountry: place.country.name,
        }
      : undefined,
    geo:
      place.latitude && place.longitude
        ? { "@type": "GeoCoordinates", latitude: place.latitude, longitude: place.longitude }
        : undefined,
    telephone: place.phone ?? undefined,
    email: place.email ?? undefined,
    sameAs: place.website ? [place.website] : undefined,
  };

  const faqLd =
    place.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: place.faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: config.pluralLabel,
        item: `${SITE_URL}/${config.slug}`,
      },
      { "@type": "ListItem", position: 3, name: place.name, item: url },
    ],
  };

  return { place: base, faq: faqLd, breadcrumb: breadcrumbLd };
}
