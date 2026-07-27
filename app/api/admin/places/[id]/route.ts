import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_CONFIG } from "@/lib/categories";
import type { PlaceCategory, PlaceStatus } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const place = await prisma.place.update({
    where: { id: params.id },
    data: {
      name: body.name,
      category: body.category as PlaceCategory,
      status: body.status as PlaceStatus,
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
      updatedById: (session.user as any).id,
    },
  });

  // Immediate on-demand ISR revalidation — an admin edit shouldn't wait for
  // the next scheduled 24h regeneration window.
  revalidatePath(`/${CATEGORY_CONFIG[place.category].slug}/${place.slug}`);

  return NextResponse.json({ id: place.id, slug: place.slug });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const place = await prisma.place.delete({ where: { id: params.id } });
  revalidatePath(`/${CATEGORY_CONFIG[place.category].slug}/${place.slug}`);

  return NextResponse.json({ ok: true });
}
