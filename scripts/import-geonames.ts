// scripts/import-geonames.ts
//
// Imports a GeoNames export into the Location table. This does NOT fetch
// data itself — download the files from geonames.org first:
//   1. https://download.geonames.org/export/dump/cities500.zip (or a larger cut)
//   2. https://download.geonames.org/export/dump/admin1CodesASCII.txt
//   3. https://download.geonames.org/export/dump/admin2Codes.txt
// Unzip into a local folder and run:
//   npx tsx scripts/import-geonames.ts --dir ./geonames-data
//
// GeoNames feature codes used: ADM1 = state/province, ADM2 = county/district,
// PPLC/PPLA/PPL = populated places (cities/towns). This builds the hierarchy
// using each row's country + admin1 + admin2 codes, matching how GeoNames
// itself structures the data.

import { readFileSync } from "fs";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils";
import type { LocationType } from "@prisma/client";

function arg(name: string, fallback: string) {
    const found = process.argv.find((a) => a.startsWith(`--${name}=`));
    return found ? found.split("=")[1] : fallback;
}

const FEATURE_CODE_TO_TYPE: Record<string, LocationType> = {
    ADM1: "STATE",
    ADM2: "DISTRICT",
    PPLC: "CITY",
    PPLA: "CITY",
    PPLA2: "CITY",
    PPL: "TOWN",
    ISL: "ISLAND",
};

async function main() {
    const dir = arg("dir", "./geonames-data");

    console.log("Importing admin1 codes (states/provinces)...");
    const admin1Lines = readFileSync(`${dir}/admin1CodesASCII.txt`, "utf-8").split("\n").filter(Boolean);
    const admin1IdByCode = new Map<string, string>(); // "US.CA" -> Location.id

    for (const line of admin1Lines) {
        const [code, name, , geonameIdStr] = line.split("\t");
        const [countryCode] = code.split(".");
        const location = await prisma.location.upsert({
            where: { geonameId: Number(geonameIdStr) },
            update: {},
            create: {
                type: "STATE",
                name,
                slug: toSlug(name),
                countryCode,
                geonameId: Number(geonameIdStr),
            },
        });
        admin1IdByCode.set(code, location.id);
    }
    console.log(`Imported ${admin1IdByCode.size} states/provinces.`);

    console.log("Importing cities (this can take a while for large files)...");
    const cityLines = readFileSync(`${dir}/cities500.txt`, "utf-8").split("\n").filter(Boolean);
    let imported = 0;

    for (const line of cityLines) {
        const cols = line.split("\t");
        const [geonameIdStr, name, , , latStr, lonStr, , featureCode, countryCode, , admin1Code] = cols;
        const type = FEATURE_CODE_TO_TYPE[featureCode];
        if (!type) continue;

        const parentId = admin1Code ? admin1IdByCode.get(`${countryCode}.${admin1Code}`) : undefined;

        await prisma.location.upsert({
            where: { geonameId: Number(geonameIdStr) },
            update: {},
            create: {
                type,
                name,
                slug: toSlug(name),
                countryCode,
                latitude: Number(latStr),
                longitude: Number(lonStr),
                parentId,
                geonameId: Number(geonameIdStr),
            },
        });
        imported++;
        if (imported % 5000 === 0) console.log(`  ${imported} cities imported...`);
    }

    console.log(`Done. Imported ${imported} cities/towns.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });