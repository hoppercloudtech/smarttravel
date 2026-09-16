// lib/discovery/pageBuilder.ts
//
// Turns CREATE-recommended opportunities into actual DiscoveryPage rows —
// this is what makes a page exist/be indexable at all. Pages that drop
// below the quality bar on a later recompute are RETIRED, never deleted
// (Section 24/38 — never orphan an indexed URL without a plan).

import { prisma } from "@/lib/prisma";
import { evaluateLocationCategoryOpportunities } from "@/lib/seo/opportunity";
import { evaluateProximityOpportunities } from "@/lib/proximityOpportunity";
import { generateSeoTitle } from "@/lib/seo/titles";
import { generateSeoDescription } from "@/lib/seo/descriptions";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { toSlug } from "@/lib/utils";

export async function materializeDiscoveryPages() {
    let created = 0, retired = 0, reactivated = 0;

    // --- LOCATION_CATEGORY ---
    const locationOpportunities = await evaluateLocationCategoryOpportunities();
    for (const opp of locationOpportunities) {
        const locationLabel = opp.cityName ? `${opp.cityName}` : opp.countryName;
        const slugBase = opp.cityName
            ? `${CATEGORY_CONFIG[opp.category].pluralLabel}-in-${locationLabel}`
            : `${CATEGORY_CONFIG[opp.category].pluralLabel}-in-${locationLabel}`;
        const slug = toSlug(slugBase);

        const existing = await prisma.discoveryPage.findUnique({ where: { slug } });
        const shouldBeIndexable = opp.recommendation === "CREATE";

        if (!existing && shouldBeIndexable) {
            await prisma.discoveryPage.create({
                data: {
                    pageType: "LOCATION_CATEGORY",
                    slug,
                    countryId: opp.countryId,
                    cityId: opp.cityId,
                    category: opp.category,
                    status: "INDEXABLE",
                    qualityScore: opp.qualityScore,
                    placeCount: opp.placeCount,
                    title: generateSeoTitle({ pageType: "LOCATION_CATEGORY", categoryPluralLabel: CATEGORY_CONFIG[opp.category].pluralLabel, cityName: opp.cityName, countryName: opp.countryName }),
                    description: generateSeoDescription({ pageType: "LOCATION_CATEGORY", categoryPluralLabelLower: CATEGORY_CONFIG[opp.category].pluralLabel.toLowerCase(), location: locationLabel, placeCount: opp.placeCount }),
                },
            });
            created++;
        } else if (existing) {
            const newStatus = shouldBeIndexable ? "INDEXABLE" : "RETIRED";
            if (existing.status !== newStatus) {
                if (newStatus === "RETIRED") retired++;
                if (newStatus === "INDEXABLE" && existing.status === "RETIRED") reactivated++;
            }
            await prisma.discoveryPage.update({
                where: { id: existing.id },
                data: { status: newStatus, qualityScore: opp.qualityScore, placeCount: opp.placeCount },
            });
        }
    }

    // --- PROXIMITY ---
    const proximityOpportunities = await evaluateProximityOpportunities();
    for (const opp of proximityOpportunities) {
        const slug = toSlug(`${CATEGORY_CONFIG[opp.category].pluralLabel}-near-${opp.landmarkName}`);
        const existing = await prisma.discoveryPage.findUnique({ where: { slug } });
        const shouldBeIndexable = opp.recommendation === "CREATE";

        if (!existing && shouldBeIndexable) {
            await prisma.discoveryPage.create({
                data: {
                    pageType: "PROXIMITY",
                    slug,
                    landmarkId: opp.landmarkId,
                    category: opp.category,
                    status: "INDEXABLE",
                    qualityScore: opp.qualityScore,
                    placeCount: opp.placeCount,
                    title: `${CATEGORY_CONFIG[opp.category].pluralLabel} Near ${opp.landmarkName} | ${process.env.NEXT_PUBLIC_SITE_NAME}`,
                    description: `Find ${CATEGORY_CONFIG[opp.category].pluralLabel.toLowerCase()} near ${opp.landmarkName} — ${opp.placeCount} places, with photos, amenities, and locations.`,
                },
            });
            created++;
        } else if (existing) {
            const newStatus = shouldBeIndexable ? "INDEXABLE" : "RETIRED";
            await prisma.discoveryPage.update({ where: { id: existing.id }, data: { status: newStatus, qualityScore: opp.qualityScore, placeCount: opp.placeCount } });
        }
    }

    console.log(`[Discovery] Pages: ${created} created, ${retired} retired, ${reactivated} reactivated.`);
    return { created, retired, reactivated };
}