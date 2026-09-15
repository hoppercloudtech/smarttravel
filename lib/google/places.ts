// lib/google/places.ts
//
// Server-only Google Places API (New) client. NEVER import this from a
// client component — GOOGLE_MAPS_API_KEY must never reach the browser.
//
// Two field mask tiers, deliberately kept separate:
//   - LIVE_DISPLAY_FIELD_MASK: used only for a one-off, live render shown
//     directly to a user (e.g. a search-fallback result card). Rich, but
//     the response is never written to the database beyond place_id/coords.
//   - DISCOVERY_FIELD_MASK: used by the background discovery job, kept as
//     minimal as possible since even transient exposure during ingestion
//     should stay small — we only need enough to queue a candidate for
//     admin review, not to display anything yet.
//
// Never use a wildcard field mask ("*") — every field in the mask is
// billed, and unused fields are pure waste.

const PLACES_API_BASE = "https://places.googleapis.com/v1";

function requireApiKey(): string {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error("GOOGLE_MAPS_API_KEY is not set.");
    return key;
}

export const LIVE_DISPLAY_FIELD_MASK = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.location",
    "places.primaryType",
    "places.types",
    "places.rating",
    "places.userRatingCount",
    "places.googleMapsUri",
].join(",");

export const DISCOVERY_FIELD_MASK = ["places.id", "places.location", "places.primaryType", "places.types", "places.displayName"].join(",");

export const DETAILS_LOCATION_ONLY_FIELD_MASK = "location"; // used only to refresh expiring coordinates — cheapest possible call

export type GooglePlaceResult = {
    id: string;
    displayName?: { text: string; languageCode: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    types?: string[];
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
};

async function callPlacesApi<T>(path: string, body: unknown, fieldMask: string): Promise<T> {
    const res = await fetch(`${PLACES_API_BASE}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": requireApiKey(),
            "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new Error(`Google Places API error (${res.status}): ${await res.text()}`);
    }
    return res.json();
}

/**
 * Text Search — used for the live search-fallback path (user typed a query,
 * nothing found in Neon). Biased toward the given country/region so results
 * stay relevant to East Africa rather than a global match.
 */
export async function textSearchPlaces(query: string, opts?: { regionCode?: string; maxResultCount?: number }): Promise<GooglePlaceResult[]> {
    const data = await callPlacesApi<{ places?: GooglePlaceResult[] }>(
        "/places:searchText",
        {
            textQuery: query,
            regionCode: opts?.regionCode,
            maxResultCount: opts?.maxResultCount ?? 5,
        },
        LIVE_DISPLAY_FIELD_MASK
    );
    return data.places ?? [];
}

/**
 * Nearby Search — used by the background discovery job. Minimal field mask
 * since this only needs to populate the candidate queue, not display
 * anything to a user yet.
 */
export async function nearbySearchPlaces(opts: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    includedTypes: string[];
    maxResultCount?: number;
}): Promise<GooglePlaceResult[]> {
    const data = await callPlacesApi<{ places?: GooglePlaceResult[] }>(
        "/places:searchNearby",
        {
            locationRestriction: {
                circle: {
                    center: { latitude: opts.latitude, longitude: opts.longitude },
                    radius: opts.radiusMeters,
                },
            },
            includedTypes: opts.includedTypes,
            maxResultCount: opts.maxResultCount ?? 20,
        },
        DISCOVERY_FIELD_MASK
    );
    return data.places ?? [];
}

/**
 * Fetches ONLY the location field for a known place_id — used exclusively
 * by the coordinate-refresh cron once a Google-sourced Place's cached
 * coordinates pass the 30-day storage limit. Deliberately the cheapest
 * possible call for this purpose.
 */
export async function refreshPlaceLocation(placeId: string): Promise<{ latitude: number; longitude: number } | null> {
    const res = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
        headers: {
            "X-Goog-Api-Key": requireApiKey(),
            "X-Goog-FieldMask": DETAILS_LOCATION_ONLY_FIELD_MASK,
        },
    });

    if (!res.ok) {
        if (res.status === 404) return null; // place no longer exists on Google's side
        throw new Error(`Google Place Details error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    return data.location ? { latitude: data.location.latitude, longitude: data.location.longitude } : null;
}

/** Required attribution per Google's Places API policy for any live-displayed result. */
export function buildGoogleAttribution(place: GooglePlaceResult) {
    return {
        text: "Listing data provided by Google",
        mapsUri: place.googleMapsUri,
    };
}