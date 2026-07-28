// lib/overpass.ts

import type { PlaceCategory } from "@prisma/client";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

export interface OverpassElement {
    id: number;
    type: "node" | "way" | "relation";

    lat?: number;
    lon?: number;

    center?: {
        lat: number;
        lon: number;
    };

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

export function buildOverpassQuery(
    country: string,
    category: PlaceCategory,
    limit = 25
) {
    const parts = CATEGORY_QUERY[category];

    // Use relation ID for Uganda, fallback to name for others
    const areaLine =
        country === "Uganda"
            ? "area(3602563194)->.searchArea;"
            : `area["name"="${country}"]->.searchArea;`;

    return `
[out:json][timeout:90];

${areaLine}

(
${parts.map((p) => `${p}(area.searchArea);`).join("\n")}
);

out center tags;
`;
}


async function fetchWithRetry(
    body: string,
    retries = 3
): Promise<OverpassResponse> {

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

            if (!response.ok) {
                throw new Error(
                    `Overpass returned ${response.status}`
                );
            }

            return await response.json();

        } catch (err) {

            lastError = err;

            await new Promise((r) =>
                setTimeout(r, (i + 1) * 2000)
            );
        }
    }

    throw lastError;
}

function buildAddress(tags: Record<string, string>) {

    return [

        tags["addr:street"],

        tags["addr:housenumber"],

        tags["addr:city"],

        tags["addr:district"],

    ]
        .filter(Boolean)
        .join(", ");
}

export async function discoverPlaces(
    country: string,
    category: PlaceCategory,
    limit = 25
): Promise<OverpassPlace[]> {

    const query = buildOverpassQuery(
        country,
        category,
        limit
    );

    const response = await fetchWithRetry(query);

    return response.elements

        .filter((e) => e.tags?.name)

        .slice(0, limit)

        .map((e) => ({

            id: `${e.type}-${e.id}`,

            name: e.tags!.name,

            category,

            country,

            city: e.tags?.["addr:city"],

            district: e.tags?.["addr:district"],

            address: buildAddress(e.tags ?? {}),

            latitude: e.lat ?? e.center?.lat,

            longitude: e.lon ?? e.center?.lon,

            website: e.tags?.website ?? e.tags?.["contact:website"],
            phone: e.tags?.phone ?? e.tags?.["contact:phone"],
            email: e.tags?.email ?? e.tags?.["contact:email"],

            description: e.tags?.description,

            amenities: Object.keys(e.tags ?? {}),

        }));
}