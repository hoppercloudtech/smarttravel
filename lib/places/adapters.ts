// lib/places/adapters.ts
//
// Converts each provider's raw result shape into the common DiscoveredPlace
// interface. This is the one place that needs to know both providers'
// response shapes — everything downstream only ever sees DiscoveredPlace.

import type { DiscoveredPlace } from "@/lib/places/types";
import type { GooglePlaceResult } from "@/lib/google/places";
import type { GeoapifyFeature } from "@/lib/geoapify/places";
import { guessCategoryFromGoogleTypes } from "@/lib/google/mapping";
import { guessCategoryFromGeoapifyCategories } from "@/lib/geoapify/mapping";

export function fromGooglePlaceResult(place: GooglePlaceResult): DiscoveredPlace | null {
    if (!place.location || !place.displayName?.text) return null;
    return {
        name: place.displayName.text,
        categoryGuess: guessCategoryFromGoogleTypes(place.types),
        address: place.formattedAddress,
        latitude: place.location.latitude,
        longitude: place.location.longitude,
        source: "google",
        sourcePlaceId: place.id,
        rawCategories: place.types ?? [],
    };
}

export function fromGeoapifyFeature(feature: GeoapifyFeature): DiscoveredPlace | null {
    const p = feature.properties;
    if (!p.name || p.lat == null || p.lon == null || !p.place_id) return null;

    const categories = p.categories ?? (p.category ? [p.category] : []);

    return {
        name: p.name,
        categoryGuess: guessCategoryFromGeoapifyCategories(categories),
        address: p.formatted,
        city: p.city,
        country: p.country,
        latitude: p.lat,
        longitude: p.lon,
        source: "geoapify",
        sourcePlaceId: p.place_id,
        rawCategories: categories,
    };
}