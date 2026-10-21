import { headers } from "next/headers";

// ISO country code -> Country.slug in your database
const CODE_TO_SLUG: Record<string, string> = {
    UG: "uganda",
    KE: "kenya",
    TZ: "tanzania",
    RW: "rwanda",
    BI: "burundi",
    SS: "south-sudan",
};

/**
 * Returns the visitor's country slug, or null if they're outside the
 * countries you cover (or the country can't be detected).
 * Locally, set DEV_COUNTRY_CODE=KE in .env.local to test.
 */
export function getVisitorCountrySlug(): string | null {
    const code = (
        headers().get("x-vercel-ip-country") ??
        process.env.DEV_COUNTRY_CODE ??
        ""
    ).toUpperCase();
    return CODE_TO_SLUG[code] ?? null;
}