// lib/overpass.ts

import type { PlaceCategory } from "@prisma/client";
import type { Region } from "@/lib/regions";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export interface OverpassElement {
    id: number;
    type: "node" | "way" | "relation";
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

export interface OverpassResponse {
    version: number;
    generator: string;
    elements: OverpassElement[];
}

export interface OverpassPlace {
    id: string;
    name: string;
    category: PlaceCategory;
    country: string;
    city?: string;
    district?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    website?: string;
    phone?: string;
    email?: string;
    description?: string;
    amenities: string[];
}

const CATEGORY_QUERY: Record<PlaceCategory, string[]> = {
    HOTEL: [
        'node["tourism"="hotel"]',
        'way["tourism"="hotel"]',
        'relation["tourism"="hotel"]',
    ],
    RESORT: [
        'node["tourism"="resort"]',
        'way["tourism"="resort"]',
        'relation["tourism"="resort"]',
    ],
    RESTAURANT: [
        'node["amenity"="restaurant"]',
        'way["amenity"="restaurant"]',
        'relation["amenity"="restaurant"]',
    ],
    AIRBNB: [
        'node["tourism"="apartment"]',
        'way["tourism"="apartment"]',
        'relation["tourism"="apartment"]',
    ],
    GUEST_HOUSE: [
        'node["tourism"="guest_house"]',
        'way["tourism"="guest_house"]',
        'relation["tourism"="guest_house"]',
    ],
    APARTMENT: [
        'node["building"="apartments"]',
        'way["building"="apartments"]',
        'relation["building"="apartments"]',
    ],
    CAMPSITE: [
        'node["tourism"="camp_site"]',
        'way["tourism"="camp_site"]',
        'relation["tourism"="camp_site"]',
    ],
    ATTRACTION: [
        'node["tourism"="attraction"]',
        'way["tourism"="attraction"]',
        'relation["tourism"="attraction"]',
    ],
};

/**
 * Builds a bbox-scoped Overpass query for one region. No `area["name"=...]`
 * lookup — the bounding box is inlined directly on every tag filter, exactly
 * like the Kampala query that worked in Overpass Turbo. This is what keeps
 * these queries fast and reliable instead of timing out.
 */
export function buildOverpassQuery(region: Region, category: PlaceCategory) {
    const parts = CATEGORY_QUERY[category];
    const bbox = region.bbox.join(",");

    return `
[out:json][timeout:60];
(
${parts.map((p) => `${p}(${bbox});`).join("\n")}
);
out center tags;
`;
}

async function fetchWithRetry(body: string, retries = 3): Promise<OverpassResponse> {
    let lastError: unknown;

    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(OVERPASS_ENDPOINT, {
                method: "POST",
                body,
                signal: controller.signal,
                headers: {
                    "Content-Type": "text/plain",
                    "User-Agent": "SmartTravel/1.0",
                },
            });

            clearTimeout(timer);

            if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
            return await response.json();
        } catch (err) {
            lastError = err;
            await new Promise((r) => setTimeout(r, (i + 1) * 2000)); // backoff: 2s, 4s, 6s
        }
    }

    throw lastError;
}

// Only these OSM tags represent genuine amenities/features — everything else
// on an element (wikidata, contact:email, name, addr:*, etc.) is metadata,
// not something a traveler would recognize as an amenity. Feeding raw tag
// keys to the AI summary generator would produce fabricated-sounding
// amenity lists like "wikidata" or "contact:email", so this is a real
// correctness fix, not just tidiness.
const AMENITY_TAG_LABELS: Record<string, string> = {
    "internet_access": "Internet access",
    "wheelchair": "Wheelchair accessible",
    "air_conditioning": "Air conditioning",
    "swimming_pool": "Swimming pool",
    "outdoor_seating": "Outdoor seating",
    "smoking": "Smoking area",
    "takeaway": "Takeaway available",
    "delivery": "Delivery available",
    "drive_through": "Drive-through",
    "parking": "Parking",
    "stars": "Star rated",
    "cuisine": "Cuisine",
    "diet:vegetarian": "Vegetarian options",
    "diet:vegan": "Vegan options",
};

function extractAmenities(tags: Record<string, string>): string[] {
    const amenities: string[] = [];
    for (const [key, value] of Object.entries(tags)) {
        if (key in AMENITY_TAG_LABELS) {
            const label = AMENITY_TAG_LABELS[key];
            amenities.push(value === "yes" ? label : `${label}: ${value}`);
        }
    }
    return amenities;
}

function buildAddress(tags: Record<string, string>) {
    return [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"], tags["addr:district"]]
        .filter(Boolean)
        .join(", ");
}

/**
 * Discovers places within a single region's bounding box. Called once per
 * region per category from the ingestion pipeline — never for a whole
 * country in one shot.
 */
export async function discoverPlaces(
    region: Region,
    category: PlaceCategory,
    limit = 25
): Promise<OverpassPlace[]> {
    const query = buildOverpassQuery(region, category);
    const response = await fetchWithRetry(query);

    return response.elements
        .filter((e) => e.tags?.name)
        .slice(0, limit)
        .map((e) => ({
            id: `${e.type}-${e.id}`,
            name: e.tags!.name,
            category,
            country: region.country,
            city: e.tags?.["addr:city"] ?? region.label,
            district: e.tags?.["addr:district"],
            address: buildAddress(e.tags ?? {}),
            latitude: e.lat ?? e.center?.lat,
            longitude: e.lon ?? e.center?.lon,
            website: e.tags?.website ?? e.tags?.["contact:website"],
            phone: e.tags?.phone ?? e.tags?.["contact:phone"],
            email: e.tags?.email ?? e.tags?.["contact:email"],
            description: e.tags?.description,
            amenities: extractAmenities(e.tags ?? {}),
        }));
}