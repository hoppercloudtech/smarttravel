import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { generateAndStoreSummary } from "@/lib/ai";
import type { PlaceCategory } from "@prisma/client";

// ============================================================================
// Background Ingestion Pipeline
// Discovers places from licensed/approved sources, normalizes and persists
// them, queues one-time AI summaries, and revalidates their pages — all
// outside the user request path, on a schedule (see /api/cron/ingest).
// ============================================================================

export type RawPlaceCandidate = {
  name: string;
  category: PlaceCategory;
  countryName: string;
  cityName?: string;
  district?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  phone?: string;
  email?: string;
  amenities?: string[];
  description?: string;
  sourceRef: string; // stable external identifier, used for de-duplication
  imageUrls?: string[]; // only URLs already confirmed to be legally reusable
};

export interface PlaceSourceAdapter {
  name: string;
  discover(opts: { country: string; category: PlaceCategory; limit: number }): Promise<RawPlaceCandidate[]>;
}

/**
 * Placeholder adapter — demonstrates the discover() contract every real
 * source must satisfy. Swap this out for adapters backed by your actual
 * licensed sources (tourism board feeds, business-submitted listings,
 * Wikimedia Commons + open datasets, partner APIs, etc). The rest of the
 * pipeline (normalize/persist/AI/revalidate) does not need to change when
 * you add a new adapter — only register it in ADAPTERS below.
 */
const sampleAdapter: PlaceSourceAdapter = {
  name: "sample-manual-seed",
  async discover({ limit }) {
    return [] as RawPlaceCandidate[]; // no-op until a real source is wired in
  },
};

export const ADAPTERS: PlaceSourceAdapter[] = [sampleAdapter];

function isSubstantiallyComplete(candidate: RawPlaceCandidate): boolean {
  return Boolean(candidate.name && candidate.countryName && (candidate.address || (candidate.latitude && candidate.longitude)));
}

/**
 * Runs one ingestion batch for a given country/category pair. This is the
 * function scheduled jobs call — see app/api/cron/ingest/route.ts.
 */
export async function runIngestionBatch(opts: {
  country: string;
  category: PlaceCategory;
  limit?: number;
  adapter?: PlaceSourceAdapter;
}) {
  const adapter = opts.adapter ?? ADAPTERS[0];
  const limit = opts.limit ?? 25;

  const batch = await prisma.ingestionBatch.create({
    data: {
      label: `${opts.country}-${opts.category}-${new Date().toISOString().slice(0, 10)}`,
      country: opts.country,
      category: opts.category,
      status: "RUNNING",
    },
  });

  const log = (data: { placeId?: string; stage: string; status: string; message?: string }) =>
    prisma.ingestionLog.create({ data: { batchId: batch.id, ...data } });

  let inserted = 0, updated = 0, skipped = 0, failed = 0, found = 0;

  try {
    // 1. DISCOVER
    const candidates = await adapter.discover({ country: opts.country, category: opts.category, limit });
    found = candidates.length;
    await log({ stage: "discover", status: "success", message: `Found ${found} candidates via ${adapter.name}` });

    const country = await prisma.country.upsert({
      where: { slug: toSlug(opts.country) },
      update: {},
      create: { name: opts.country, slug: toSlug(opts.country) },
    });

    for (const candidate of candidates) {
      try {
        // 2. NORMALIZE + dedupe check
        if (!isSubstantiallyComplete(candidate)) {
          skipped++;
          await log({ stage: "normalize", status: "skipped", message: `Incomplete data for "${candidate.name}"` });
          continue;
        }

        const existing = await prisma.place.findFirst({
          where: { OR: [{ sourceRef: candidate.sourceRef }, { name: candidate.name, countryId: country.id }] },
        });

        let city = null;
        if (candidate.cityName) {
          city = await prisma.city.upsert({
            where: { countryId_slug: { countryId: country.id, slug: toSlug(candidate.cityName) } },
            update: {},
            create: { name: candidate.cityName, slug: toSlug(candidate.cityName), countryId: country.id },
          });
        }

        // 3. ENRICH (kept minimal here — a real adapter would geocode
        // missing coordinates and resolve district names at this stage)

        // 4. PERSIST
        const baseSlug = toSlug(candidate.name);
        let slug = existing?.slug ?? baseSlug;
        if (!existing) {
          let suffix = 1;
          while (await prisma.place.findUnique({ where: { slug } })) slug = `${baseSlug}-${++suffix}`;
        }

        const status = isSubstantiallyComplete(candidate) ? "PUBLISHED" : "NEEDS_REVIEW";

        const place = existing
          ? await prisma.place.update({
              where: { id: existing.id },
              data: {
                district: candidate.district,
                address: candidate.address,
                latitude: candidate.latitude,
                longitude: candidate.longitude,
                website: candidate.website,
                phone: candidate.phone,
                email: candidate.email,
                amenities: candidate.amenities ?? [],
                description: candidate.description,
                refreshStatus: "QUEUED",
              },
            })
          : await prisma.place.create({
              data: {
                name: candidate.name,
                slug,
                category: candidate.category,
                status,
                countryId: country.id,
                cityId: city?.id,
                district: candidate.district,
                address: candidate.address,
                latitude: candidate.latitude,
                longitude: candidate.longitude,
                website: candidate.website,
                phone: candidate.phone,
                email: candidate.email,
                amenities: candidate.amenities ?? [],
                description: candidate.description,
                source: adapter.name,
                sourceRef: candidate.sourceRef,
                refreshStatus: "QUEUED",
                imageStatus: candidate.imageUrls?.length ? "PENDING" : "NONE_AVAILABLE",
              },
            });

        existing ? updated++ : inserted++;
        await log({ placeId: place.id, stage: "persist", status: "success" });

        // 5. QUEUE AI — batched, one summary per place, never on a public request
        try {
          await generateAndStoreSummary(place.id, "ingestion");
          await log({ placeId: place.id, stage: "queue-ai", status: "success" });
        } catch (aiErr) {
          await log({
            placeId: place.id,
            stage: "queue-ai",
            status: "failed",
            message: aiErr instanceof Error ? aiErr.message : "Unknown AI error",
          });
        }

        // 6. REVALIDATE — make the page servable/crawlable immediately
        if (place.status === "PUBLISHED") {
          revalidatePath(`/${CATEGORY_CONFIG[place.category].slug}/${place.slug}`);
        }
        await log({ placeId: place.id, stage: "revalidate", status: "success" });
      } catch (err) {
        failed++;
        await log({
          stage: "persist",
          status: "failed",
          message: `"${candidate.name}": ${err instanceof Error ? err.message : "unknown error"}`,
        });
      }
    }

    await prisma.ingestionBatch.update({
      where: { id: batch.id },
      data: {
        status: failed > 0 && inserted + updated === 0 ? "FAILED" : failed > 0 ? "PARTIAL" : "SUCCEEDED",
        totalFound: found,
        totalInserted: inserted,
        totalUpdated: updated,
        totalSkipped: skipped,
        totalFailed: failed,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.ingestionBatch.update({
      where: { id: batch.id },
      data: { status: "FAILED", finishedAt: new Date() },
    });
    await log({ stage: "discover", status: "failed", message: err instanceof Error ? err.message : "Unknown error" });
  }

  return prisma.ingestionBatch.findUniqueOrThrow({ where: { id: batch.id } });
}

/**
 * Recomputes "Nearby" relations for a city using simple haversine distance
 * between published places in the same city. Run periodically after
 * ingestion rather than computed live on every page view.
 */
export async function recomputeNearbyForCity(cityId: string) {
  const places = await prisma.place.findMany({
    where: { cityId, status: "PUBLISHED", latitude: { not: null }, longitude: { not: null } },
  });

  function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  for (const from of places) {
    const distances = places
      .filter((p) => p.id !== from.id)
      .map((to) => ({
        to,
        km: haversineKm(from.latitude!, from.longitude!, to.latitude!, to.longitude!),
      }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 6);

    for (const [rank, d] of distances.entries()) {
      await prisma.nearbyRelation.upsert({
        where: { fromPlaceId_toPlaceId_relationType: { fromPlaceId: from.id, toPlaceId: d.to.id, relationType: "nearby" } },
        update: { distanceKm: d.km, rank },
        create: { fromPlaceId: from.id, toPlaceId: d.to.id, relationType: "nearby", distanceKm: d.km, rank },
      });
    }
  }
}
