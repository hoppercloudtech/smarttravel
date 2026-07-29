import { runIngestionBatch } from "@/jobs/ingest";
import type { PlaceCategory } from "@prisma/client";

function arg(name: string, fallback: string): string {
  const found = process.argv.find((a) =>
    a.startsWith(`--${name}=`)
  );

  return found ? found.split("=")[1] : fallback;
}

async function main() {
  const district = arg("district","");
  const country = arg("country", "Uganda");

  const regionKey = arg(
    "region",
    district ? district.toLowerCase() : "kampala"
  );

  const category = arg("category", "HOTEL") as PlaceCategory;

  const limit = Number(arg("limit", "25"));

  console.log(
    district
      ? `Running ingestion batch: ${district}, ${country} / ${category} (limit ${limit})`
      : `Running ingestion batch: ${regionKey} / ${category} (limit ${limit})`
  );

  const batch = await runIngestionBatch({
    regionKey,
    customLocation: district
      ? { district, country: country! }
      : undefined,
    category,
    limit,
  });

  console.log(JSON.stringify(batch, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });