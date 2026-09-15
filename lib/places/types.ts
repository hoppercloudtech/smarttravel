// lib/places/types.ts
//
// Common internal representation both Google and Geoapify results get
// converted into, so the rest of the system (dedup, candidate queue, admin
// review) never needs to know which provider a place came from.

import type { PlaceCategory } from "@prisma/client";

export type PlaceProvider = "google" | "geoapify";

export interface DiscoveredPlace {
    name: string;
    categoryGuess: PlaceCategory | null;
    address?: string;
    city?: string;
    country?: string;
    latitude: number;
    longitude: number;
    source: PlaceProvider;
    sourcePlaceId: string; // the provider's own place identifier — never assumed comparable across providers
    rawCategories: string[]; // for debugging the category mapping, same spirit as existing rawTypes usage
}