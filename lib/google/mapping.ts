// lib/google/mapping.ts
//
// Google's place "types" taxonomy doesn't line up 1:1 with PlaceCategory, so
// this is an explicit mapping layer rather than an assumption. Two
// directions: Google type → our category (for classifying discovered
// places), and our category → Google `includedTypes` (for nearby-search
// discovery queries).

import type { PlaceCategory } from "@prisma/client";

// Ordered by specificity — first match wins when a place has multiple types.
const GOOGLE_TYPE_TO_CATEGORY: [string, PlaceCategory][] = [
    ["resort_hotel", "RESORT"],
    ["guest_house", "GUEST_HOUSE"],
    ["bed_and_breakfast", "GUEST_HOUSE"],
    ["campground", "CAMPSITE"],
    ["rv_park", "CAMPSITE"],
    ["hotel", "HOTEL"],
    ["motel", "HOTEL"],
    ["extended_stay_hotel", "APARTMENT"],
    ["apartment_building", "APARTMENT"],
    ["restaurant", "RESTAURANT"],
    ["cafe", "RESTAURANT"],
    ["bar", "RESTAURANT"],
    ["tourist_attraction", "ATTRACTION"],
    ["museum", "ATTRACTION"],
    ["park", "ATTRACTION"],
    ["national_park", "ATTRACTION"],
    ["zoo", "ATTRACTION"],
    ["amusement_park", "ATTRACTION"],
];

/** Best-guess category from Google's `types` array. Returns null if nothing recognizable maps — the candidate then needs a manual category pick during admin review, never silently guessed as a default. */
export function guessCategoryFromGoogleTypes(types: string[] | undefined): PlaceCategory | null {
    if (!types) return null;
    for (const [googleType, category] of GOOGLE_TYPE_TO_CATEGORY) {
        if (types.includes(googleType)) return category;
    }
    return null;
}

// Inverse mapping — which Google `includedTypes` to search for a given
// PlaceCategory during background discovery (searchNearby).
export const CATEGORY_TO_GOOGLE_TYPES: Record<PlaceCategory, string[]> = {
    HOTEL: ["hotel", "motel"],
    RESORT: ["resort_hotel"],
    GUEST_HOUSE: ["guest_house", "bed_and_breakfast"],
    APARTMENT: ["extended_stay_hotel", "apartment_building"],
    CAMPSITE: ["campground", "rv_park"],
    RESTAURANT: ["restaurant", "cafe"],
    ATTRACTION: ["tourist_attraction", "museum", "park", "national_park", "zoo", "amusement_park"],
    // Google's public Places types have no clean "individually-listed short-term rental" category —
    // Airbnb-style listings aren't something Nearby Search can discover this way.
    // Left out of automated discovery entirely; Airbnb-category places stay
    // OSM/manual-sourced only. Listed here so the Record stays exhaustive.
    AIRBNB: [],
};