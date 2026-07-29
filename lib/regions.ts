// lib/regions.ts
//
// Overpass times out on whole-country `area["name"="Uganda"]` queries because
// the server has to compute the full country polygon before it can even
// start matching tags. A bounding box skips that step entirely — the server
// just checks coordinates — which is why small-region queries return
// instantly. This file is the list of regions the ingestion pipeline works
// through, one bbox at a time, instead of ever querying a whole country.
//
// bbox order is [south, west, north, east] — same order Overpass expects.

export type Region = {
    key: string;
    label: string;
    country: string;
    bbox: [number, number, number, number];
};

export const REGIONS: Region[] = [
    { key: "kampala", label: "Kampala", country: "Uganda", bbox: [0.25, 32.5, 0.45, 32.7] },
    { key: "entebbe", label: "Entebbe", country: "Uganda", bbox: [0.03, 32.42, 0.10, 32.50] },
    { key: "jinja", label: "Jinja", country: "Uganda", bbox: [0.40, 33.15, 0.48, 33.25] },
    { key: "mbarara", label: "Mbarara", country: "Uganda", bbox: [-0.65, 30.60, -0.58, 30.70] },
    { key: "gulu", label: "Gulu", country: "Uganda", bbox: [2.75, 32.28, 2.82, 32.35] },
    { key: "fort-portal", label: "Fort Portal", country: "Uganda", bbox: [0.65, 30.25, 0.70, 30.30] },
];

export function getRegion(key: string): Region {
    const region = REGIONS.find((r) => r.key === key);
    if (!region) throw new Error(`Unknown region "${key}". Add it to lib/regions.ts first.`);
    return region;
}