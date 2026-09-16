import { prisma } from "@/lib/prisma";
import { computeDiscoverySignals } from "@/lib/discovery/signals";
import type { PlaceCategory } from "@prisma/client";

export async function recomputeAllDiscoveryScores() {
    const categories = await prisma.place.groupBy({ by: ["category"], where: { status: "PUBLISHED" } });
    let total = 0;

    for (const { category } of categories) {
        const places = await prisma.place.findMany({ where: { status: "PUBLISHED", category: category as PlaceCategory } });
        const maxViewCount = Math.max(0, ...places.map((p) => p.viewCount));

        for (const place of places) {
            const signals = await computeDiscoverySignals(place, maxViewCount);
            await prisma.placeDiscoveryScore.upsert({
                where: { placeId: place.id },
                update: signals,
                create: { placeId: place.id, ...signals },
            });
            total++;
        }
    }

    console.log(`[Discovery] Recomputed scores for ${total} places.`);
    return { total };
}