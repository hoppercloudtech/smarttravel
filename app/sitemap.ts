import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://horizonspot.site";

// Next.js splits this automatically once it exceeds ~50,000 URLs by
// generating sitemap.xml/[id] variants if you export generateSitemaps() —
// add that once place count approaches that range. Fine as a single file
// well beyond your initial East Africa catalogue size.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const places = await prisma.place.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true, category: true, updatedAt: true },
  });

  const placeUrls: MetadataRoute.Sitemap = places.map((p) => ({
    url: `${SITE_URL}/${CATEGORY_CONFIG[p.category].slug}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryUrls: MetadataRoute.Sitemap = Object.values(CATEGORY_CONFIG).map((c) => ({
    url: `${SITE_URL}/${c.slug}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [{ url: SITE_URL, changeFrequency: "daily", priority: 1.0 }, ...categoryUrls, ...placeUrls];
}
