// lib/geocode.ts
//
// Resolves a free-text district/area + country (e.g. "Mbale", "Uganda") into
// a Region with a real bounding box, using Nominatim — OpenStreetMap's own
// geocoder, the same project Overpass data comes from. This is what powers
// the "custom location" ingestion option: instead of only picking from the
// hardcoded list in lib/regions.ts, an admin can type any place name and get
// a working bbox for it.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a descriptive User-Agent and caps requests at ~1/second — fine for
// this use case, since it's one lookup per manually-triggered batch, not a
// loop.

import type { Region } from "@/lib/regions";
import { toSlug } from "@/lib/utils";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

// A district-sized bbox should be well under this. If Nominatim's match is
// bigger than this (e.g. the query was ambiguous and it matched the whole
// country instead of the district), we reject it rather than silently
// handing back a country-wide box — that's exactly the query that used to
// time out Overpass in the first place.
const MAX_SPAN_DEGREES = 1.2; // roughly ~130km — generous for a district, well short of a country

type NominatimResult = {
    display_name: string;
    boundingbox: [string, string, string, string]; // [south, north, west, east] as strings
    lat: string;
    lon: string;
    type: string;
    class: string;
};

export class GeocodeError extends Error { }

/**
 * Resolves "district, country" into a Region with a real bbox. Throws
 * GeocodeError (with a message safe to show an admin) if nothing is found,
 * or if the match is too large to query safely.
 */
export async function resolveRegionFromPlaceName(
    districtOrArea: string,
    country: string
): Promise<Region> {
    const query = `${districtOrArea}, ${country}`;
    const params = new URLSearchParams({
        q: query,
        format: "json",
        addressdetails: "0",
        limit: "1",
    });

    const res = await fetch(`${NOMINATIM_ENDPOINT}?${params}`, {
        headers: {
            // Nominatim rejects generic/browser-default User-Agents — needs to
            // identify the application per their usage policy.
            "User-Agent": "SmartTravel/1.0 (East Africa travel discovery platform)",
        },
    });

    if (!res.ok) {
        throw new GeocodeError(`Nominatim lookup failed (${res.status}). Try again in a moment.`);
    }

    const results = (await res.json()) as NominatimResult[];
    if (results.length === 0) {
        throw new GeocodeError(
            `Couldn't find "${districtOrArea}, ${country}". Check the spelling, or try a nearby larger town/district name.`
        );
    }

    const match = results[0];
    const [southStr, northStr, westStr, eastStr] = match.boundingbox;
    const south = parseFloat(southStr);
    const north = parseFloat(northStr);
    const west = parseFloat(westStr);
    const east = parseFloat(eastStr);

    const latSpan = north - south;
    const lonSpan = east - west;

    if (latSpan > MAX_SPAN_DEGREES || lonSpan > MAX_SPAN_DEGREES) {
        throw new GeocodeError(
            `"${districtOrArea}" matched an area too large to query safely (${match.display_name}) — this is likely the whole country or a large region, and would time out the same way the original whole-country query did. Try a specific district, town, or neighborhood name instead.`
        );
    }

    return {
        key: `custom-${toSlug(districtOrArea)}-${toSlug(country)}`,
        label: districtOrArea,
        country,
        bbox: [south, west, north, east],
    };
}