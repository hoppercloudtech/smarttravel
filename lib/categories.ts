import type { PlaceCategory } from "@prisma/client";

// Single source of truth mapping the Prisma enum to public URL segments,
// display labels, and the correct Schema.org type for JSON-LD. Every route,
// form, and structured-data builder reads from this file instead of
// hardcoding category strings in multiple places.
export const CATEGORY_CONFIG: Record<
  PlaceCategory,
  { slug: string; label: string; pluralLabel: string; schemaType: string }
> = {
  HOTEL: { slug: "hotel", label: "Hotel", pluralLabel: "Hotels", schemaType: "LodgingBusiness" },
  RESORT: { slug: "resort", label: "Resort", pluralLabel: "Resorts", schemaType: "Resort" },
  RESTAURANT: { slug: "restaurant", label: "Restaurant", pluralLabel: "Restaurants", schemaType: "Restaurant" },
  AIRBNB: { slug: "airbnb", label: "Airbnb", pluralLabel: "Airbnbs", schemaType: "LodgingBusiness" },
  GUEST_HOUSE: { slug: "guest-house", label: "Guest House", pluralLabel: "Guest Houses", schemaType: "LodgingBusiness" },
  APARTMENT: { slug: "apartment", label: "Apartment", pluralLabel: "Apartments", schemaType: "Apartment" },
  CAMPSITE: { slug: "campsite", label: "Campsite", pluralLabel: "Campsites", schemaType: "Campground" },
  ATTRACTION: { slug: "attraction", label: "Attraction", pluralLabel: "Attractions", schemaType: "TouristAttraction" },
};

export const CATEGORY_SLUGS = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([enumKey, cfg]) => [cfg.slug, enumKey as PlaceCategory])
) as Record<string, PlaceCategory>;

export function categoryFromUrlSlug(slug: string): PlaceCategory | null {
  return CATEGORY_SLUGS[slug] ?? null;
}
