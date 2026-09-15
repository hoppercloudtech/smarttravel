// lib/geoapify/places.ts
//
// Server-only Geoapify client — same "server-only, never expose the key"
// discipline as lib/google/places.ts. Two endpoints:
//   - Places API (v2/places): category+location discovery, the fallback for
//     background discovery (Google Nearby Search's counterpart).
//   - Geocoding API (v1/geocode/search): free-text lookup, the fallback for
//     live search (Google Text Search's counterpart) — Geoapify's Places
//     endpoint itself is category-based, not name-search based, so
//     Geocoding is the correct equivalent here, not a workaround.

const GEOAPIFY_BASE = "https://api.geoapify.com";

function requireApiKey(): string {
    const key = process.env.GEOAPIFY_API_KEY;
    if (!key) throw new Error("GEOAPIFY_API_KEY is not set.");
    return key;
}

export type GeoapifyFeatureProperties = {
    name?: string;
    formatted?: string;
    city?: string;
    country?: string;
    categories?: string[];
    category?: string; // some Geocoding responses use singular `category` instead of `categories`
    lat?: number;
    lon?: number;
    place_id?: string;
};

export type GeoapifyFeature = {
    properties: GeoapifyFeatureProperties;
};

async function callGeoapify(path: string, params: Record<string, string>): Promise<{ features?: GeoapifyFeature[] }> {
    const url = new URL(`${GEOAPIFY_BASE}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("apiKey", requireApiKey());

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`Geoapify API error (${res.status}): ${await res.text()}`);
    }
    return res.json();
}

/** Places API — category + circle search. The Nearby Search equivalent. */
export async function searchNearbyGeoapify(opts: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    categories: string[];
    limit?: number;
}): Promise<GeoapifyFeature[]> {
    if (opts.categories.length === 0) return [];

    const data = await callGeoapify("/v2/places", {
        categories: opts.categories.join(","),
        filter: `circle:${opts.longitude},${opts.latitude},${opts.radiusMeters}`,
        limit: String(opts.limit ?? 20),
    });
    return data.features ?? [];
}

/** Geocoding API — free-text search. The Text Search equivalent. */
export async function searchTextGeoapify(query: string, opts?: { countryCode?: string; limit?: number }): Promise<GeoapifyFeature[]> {
    const data = await callGeoapify("/v1/geocode/search", {
        text: query,
        ...(opts?.countryCode ? { filter: `countrycode:${opts.countryCode.toLowerCase()}` } : {}),
        limit: String(opts?.limit ?? 5),
        format: "geojson",
    });
    return data.features ?? [];
}