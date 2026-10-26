// lib/placeIssues.ts
//
// Single source of truth for "what is missing on a place". Used by the admin
// Overview (counts), the Places list (filters + per-row badges).

import { Prisma } from "@prisma/client";

export const ISSUE_KEYS = [
    "images",
    "coordinates",
    "city",
    "district",
    "address",
    "website",
    "phone",
    "maps",
    "amenities",
    "description",
    "summary",
] as const;

export type IssueKey = (typeof ISSUE_KEYS)[number];

/** The fields needed to evaluate issues on an already-loaded place row. */
export type PlaceIssueSource = {
    latitude: number | null;
    longitude: number | null;
    cityId: string | null;
    district: string | null;
    address: string | null;
    website: string | null;
    phone: string | null;
    googleMapsUrl: string | null;
    amenities: unknown;
    description: string | null;
    _count: { media: number; summaries: number };
};

/** Use this on findMany so rows satisfy PlaceIssueSource. */
export const ISSUE_COUNTS = {
    select: { media: true, summaries: { where: { isCurrent: true } } },
} as const;

const blank = (v: string | null) => v === null || v.trim() === "";
const emptyAmenities = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && v.length === 0);

export const ISSUES: Record<
    IssueKey,
    { label: string; where: Prisma.PlaceWhereInput; test: (p: PlaceIssueSource) => boolean }
> = {
    images: {
        label: "Images",
        where: { media: { none: {} } },
        test: (p) => p._count.media === 0,
    },
    coordinates: {
        label: "Latitude / longitude",
        where: { OR: [{ latitude: null }, { longitude: null }] },
        test: (p) => p.latitude === null || p.longitude === null,
    },
    city: {
        label: "City",
        where: { cityId: null },
        test: (p) => p.cityId === null,
    },
    district: {
        label: "District / area",
        where: { OR: [{ district: null }, { district: "" }] },
        test: (p) => blank(p.district),
    },
    address: {
        label: "Address",
        where: { OR: [{ address: null }, { address: "" }] },
        test: (p) => blank(p.address),
    },
    website: {
        label: "Website",
        where: { OR: [{ website: null }, { website: "" }] },
        test: (p) => blank(p.website),
    },
    phone: {
        label: "Phone",
        where: { OR: [{ phone: null }, { phone: "" }] },
        test: (p) => blank(p.phone),
    },
    maps: {
        label: "Google Maps URL",
        where: { OR: [{ googleMapsUrl: null }, { googleMapsUrl: "" }] },
        test: (p) => blank(p.googleMapsUrl),
    },
    amenities: {
        label: "Amenities",
        where: {
            OR: [
                { amenities: { equals: Prisma.DbNull } },
                { amenities: { equals: Prisma.JsonNull } },
                { amenities: { equals: [] } },
            ],
        },
        test: (p) => emptyAmenities(p.amenities),
    },
    description: {
        label: "Source description",
        where: { OR: [{ description: null }, { description: "" }] },
        test: (p) => blank(p.description),
    },
    summary: {
        label: "AI summary",
        where: { summaries: { none: { isCurrent: true } } },
        test: (p) => p._count.summaries === 0,
    },
};

export function getMissing(p: PlaceIssueSource): IssueKey[] {
    return ISSUE_KEYS.filter((k) => ISSUES[k].test(p));
}

/** Parses "?missing=images,phone" into valid keys only. */
export function parseMissingParam(raw: string | undefined): IssueKey[] {
    if (!raw) return [];
    const wanted = raw.split(",").map((s) => s.trim());
    return ISSUE_KEYS.filter((k) => wanted.includes(k));
}

/** A place must match ALL selected issues (e.g. no images AND no phone). */
export function buildMissingWhere(keys: IssueKey[]): Prisma.PlaceWhereInput {
    return keys.length === 0 ? {} : { AND: keys.map((k) => ISSUES[k].where) };
}