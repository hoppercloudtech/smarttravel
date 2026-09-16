// lib/seo/descriptions.ts
//
// Centralized description generation (Section 17). Every fact used here
// must come from real database values — never invented to make a snippet
// more attractive (Section 17's explicit rule, Section 20's AI content
// policy).

export type SeoDescriptionInput =
    | { pageType: "PLACE"; placeName: string; aiSummary?: string | null; categoryLabel: string; location: string }
    | { pageType: "LOCATION_CATEGORY"; categoryPluralLabelLower: string; location: string; placeCount: number };

export function generateSeoDescription(input: SeoDescriptionInput): string {
    switch (input.pageType) {
        case "PLACE": {
            if (input.aiSummary) {
                return input.aiSummary.slice(0, 155).trim() + (input.aiSummary.length > 155 ? "…" : "");
            }
            return `${input.placeName} is a ${input.categoryLabel.toLowerCase()} in ${input.location}. See photos, amenities, location and more.`;
        }
        case "LOCATION_CATEGORY": {
            // placeCount is a real, current database count — never a rounded or invented figure.
            return `Explore ${input.placeCount} ${input.categoryPluralLabelLower} in ${input.location} — browse photos, amenities, and locations.`;
        }
    }
}