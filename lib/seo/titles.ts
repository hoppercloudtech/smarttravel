// lib/seo/titles.ts
//
// Centralized title generation (Section 16) — the single place title
// strings get built, so they're never scattered across page components.
// Extensible via the discriminated union: add a new pageType variant here
// when Phase 3's discovery pages are built, without touching callers of
// the PLACE variant.

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "HorizonSpot";

export type SeoTitleInput =
    | { pageType: "PLACE"; placeName: string; categoryLabel: string; cityName?: string | null; countryName: string }
    | { pageType: "LOCATION_CATEGORY"; categoryPluralLabel: string; cityName?: string | null; countryName: string };

export function generateSeoTitle(input: SeoTitleInput): string {
    switch (input.pageType) {
        case "PLACE": {
            const location = input.cityName ?? input.countryName;
            return `${input.placeName} — ${input.categoryLabel} in ${location} | ${SITE_NAME}`;
        }
        case "LOCATION_CATEGORY": {
            const location = input.cityName ? `${input.cityName}, ${input.countryName}` : input.countryName;
            return `Best ${input.categoryPluralLabel} in ${location} | ${SITE_NAME}`;
        }
    }
}