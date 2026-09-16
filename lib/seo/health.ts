// lib/seo/health.ts
//
// Per-place SEO health check (Section 18) — every check is a real,
// measurable boolean against actual fields. No decorative scoring.

import { prisma } from "@/lib/prisma";

export type SeoHealthCheck = { key: string; label: string; passed: boolean };
export type PlaceSeoHealth = { placeId: string; placeName: string; score: number; checks: SeoHealthCheck[] };

export async function computePlaceSeoHealth(placeId: string): Promise<PlaceSeoHealth> {
    const place = await prisma.place.findUniqueOrThrow({
        where: { id: placeId },
        include: { media: true, summaries: { where: { isCurrent: true } }, faqs: true },
    });

    const checks: SeoHealthCheck[] = [
        { key: "description", label: "Source description present", passed: Boolean(place.description) },
        { key: "aiSummary", label: "AI summary generated", passed: place.summaries.length > 0 },
        { key: "heroImage", label: "Has a hero image", passed: place.media.some((m) => m.isHero) },
        { key: "coordinates", label: "Has coordinates", passed: place.latitude != null && place.longitude != null },
        { key: "address", label: "Has an address", passed: Boolean(place.address) },
        { key: "amenities", label: "Has listed amenities", passed: Array.isArray(place.amenities) && (place.amenities as unknown[]).length > 0 },
        { key: "faqs", label: "Has FAQs", passed: place.faqs.length > 0 },
    ];

    const score = Math.round((checks.filter((c) => c.passed).length / checks.length) * 100);
    return { placeId: place.id, placeName: place.name, score, checks };
}