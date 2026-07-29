// CLI entry point for running an ingestion batch locally, outside of the
// Vercel Cron schedule. Two usage modes:
//
//   Preset region:   npm run ingest -- --region=kampala --category=HOTEL
//   Any district:    npm run ingest -- --district=Mbale --country=Uganda --category=HOTEL
import { runIngestionBatch } from "@/jobs/ingest";
import type { PlaceCategory } from "@prisma/client";
import { resolveRegionFromPlaceName } from "@/lib/geocode";

function arg(name: string, fallback?: string) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : fallback;
}

async function main() {
  const district = arg("district");
  const country = arg("country", "Uganda");
  const regionKey = arg("region", district ? undefined : "kampala");
  const category = arg("category", "HOTEL") as PlaceCategory;
  const limit = Number(arg("limit", "25"));

  console.log(
    district
      ? `Running ingestion batch: ${district}, ${country} / ${category} (limit ${limit})`
      : `Running ingestion batch: ${regionKey} / ${category} (limit ${limit})`
  );

  const batch = await runIngestionBatch({
    regionKey,
    customLocation: district ? { district, country: country! } : undefined,
    category,
    limit,
  });
  console.log(JSON.stringify(batch, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });