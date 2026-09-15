// lib/geoapify/mapping.ts
//
// Mirrors lib/google/mapping.ts's shape exactly, but for Geoapify's category
// taxonomy — kept as a separate file rather than merged, since the two
// providers' category systems don't line up and conflating them would make
// both harder to maintain.

import type { PlaceCategory } from "@prisma/client";

const GEOAPIFY_CATEGORY_TO_PLACE_CATEGORY: [string, PlaceCategory][] = [
    ["accommodation.guest_house", "GUEST_HOUSE"],
    ["accommodation.apartment", "APARTMENT"],
    ["accommodation.hostel", "GUEST_HOUSE"],
    ["accommodation.hotel", "HOTEL"],
    ["accommodation.motel", "HOTEL"],
    ["camping.camp_site", "CAMPSITE"],
    ["camping", "CAMPSITE"],
    ["catering.restaurant", "RESTAURANT"],
    ["catering.cafe", "RESTAURANT"],
    ["catering.bar", "RESTAURANT"],
    ["tourism.attraction", "ATTRACTION"],
    ["tourism.sights", "ATTRACTION"],
    ["entertainment", "ATTRACTION"],
    ["leisure.park", "ATTRACTION"],
];

/** Best-guess PlaceCategory from Geoapify's `categories` array. Returns null if nothing maps — same policy as the Google mapping: never silently default, force a manual pick during admin review. */
export function guessCategoryFromGeoapifyCategories(categories: string[] | undefined): PlaceCategory | null {
    if (!categories) return null;
    for (const [geoapifyCategory, placeCategory] of GEOAPIFY_CATEGORY_TO_PLACE_CATEGORY) {
        if (categories.some((c) => c === geoapifyCategory || c.startsWith(geoapifyCategory + "."))) return placeCategory;
    }
    return null;
}

// Inverse — which Geoapify categories to query for a given PlaceCategory
// during discovery. Geoapify has no distinct "resort" subtype, so RESORT
// falls back to the general hotel category — a real taxonomy gap, not an
// oversight; document it if resort-specific discovery quality matters later.
export const CATEGORY_TO_GEOAPIFY_CATEGORIES: Record<PlaceCategory, string[]> = {
    HOTEL: ["accommodation.hotel", "accommodation.motel"],
    RESORT: ["accommodation.hotel"],
    GUEST_HOUSE: ["accommodation.guest_house", "accommodation.hostel"],
    APARTMENT: ["accommodation.apartment"],
    CAMPSITE: ["camping.camp_site"],
    RESTAURANT: ["catering.restaurant", "catering.cafe"],
    ATTRACTION: ["tourism.attraction", "tourism.sights"],
    // Same gap as Google — no individually-listed short-term-rental category
    // exists in Geoapify's taxonomy either. Kept out of automated discovery.
    AIRBNB: [],
};