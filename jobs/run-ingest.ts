// CLI entry point for running an ingestion batch locally, outside of the
// Vercel Cron schedule — useful for testing an adapter before deploying it.
// Usage: npm run ingest -- --country=Uganda --category=HOTEL
import { runIngestionBatch } from "@/jobs/ingest";
import type { PlaceCategory } from "@prisma/client";

function arg(name: string, fallback: string) {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : fallback;
}

async function main() {
  const country = arg("country", "Uganda");
  const category = arg("category", "HOTEL") as PlaceCategory;
  const limit = Number(arg("limit", "25"));

  console.log(`Running ingestion batch: ${country} / ${category} (limit ${limit})`);
  const batch = await runIngestionBatch({ country, category, limit });
  console.log(JSON.stringify(batch, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
