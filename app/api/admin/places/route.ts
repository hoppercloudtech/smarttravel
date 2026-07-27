import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils";
import { CATEGORY_CONFIG } from "@/lib/categories";
import type { PlaceCategory, PlaceStatus } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const baseSlug = toSlug(body.name);

  // Ensure slug uniqueness — append a short suffix on collision rather than
  // failing the save, since duplicate names across cities are common
  // ("Cafe Javas" appears in several malls).
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.place.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++suffix}`;
  }

  const place = await prisma.place.create({
    data: {
      name: body.name,
      slug,
      category: body.category as PlaceCategory,
      status: (body.status as PlaceStatus) ?? "DRAFT",
      countryId: body.countryId,
      cityId: body.cityId || null,
      district: body.district || null,
      address: body.address || null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      googleMapsUrl: body.googleMapsUrl || null,
      website: body.website || null,
      phone: body.phone || null,
      email: body.email || null,
      amenities: body.amenities ?? [],
      description: body.description || null,
      featured: Boolean(body.featured),
      createdById: (session.user as any).id,
      updatedById: (session.user as any).id,
    },
  });

  if (place.status === "PUBLISHED") {
    revalidatePath(`/${CATEGORY_CONFIG[place.category].slug}/${place.slug}`);
  }

  return NextResponse.json({ id: place.id, slug: place.slug });
}
