import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils";

async function main() {
  console.log("Seeding SmartTravel...");

  // --- Admin user ---------------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@horizonspot.site";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "SmartTravel Admin", email: adminEmail, passwordHash, role: "SUPER_ADMIN" },
  });
  console.log(`Admin user ready: ${adminEmail} / ${adminPassword} (change this after first login)`);

  // --- Countries -----------------------------------------------------------
  const countryNames = ["Uganda", "Kenya", "Tanzania", "Rwanda", "Burundi", "South Sudan"];
  const countries: Record<string, { id: string }> = {};
  for (const name of countryNames) {
    countries[name] = await prisma.country.upsert({
      where: { slug: toSlug(name) },
      update: {},
      create: { name, slug: toSlug(name) },
    });
  }

  // --- Sample cities ---------------------------------------------------------
  const kampala = await prisma.city.upsert({
    where: { countryId_slug: { countryId: countries["Uganda"].id, slug: "kampala" } },
    update: {},
    create: { name: "Kampala", slug: "kampala", countryId: countries["Uganda"].id, latitude: 0.3476, longitude: 32.5825 },
  });

  // --- One sample published place, so the site isn't empty on first run ---
  const existing = await prisma.place.findUnique({ where: { slug: "speke-resort-munyonyo" } });
  if (!existing) {
    await prisma.place.create({
      data: {
        name: "Speke Resort Munyonyo",
        slug: "speke-resort-munyonyo",
        category: "RESORT",
        status: "PUBLISHED",
        countryId: countries["Uganda"].id,
        cityId: kampala.id,
        district: "Munyonyo",
        address: "Munyonyo, Kampala, Uganda",
        latitude: 0.2626,
        longitude: 32.6259,
        website: "https://spekeresort.com",
        amenities: ["Lakeside views", "Conference facilities", "Swimming pools", "Multiple restaurants"],
        description:
          "A large lakeside resort on Lake Victoria in Munyonyo, Kampala, with conference facilities, several restaurants, and multiple swimming pools. Frequently used for regional summits and conferences.",
        featured: true,
      },
    });
    console.log("Created sample place: Speke Resort Munyonyo");
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
