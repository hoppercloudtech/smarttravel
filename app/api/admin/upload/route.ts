import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const placeId = formData.get("placeId") as string | null;
  if (!file || !placeId) return NextResponse.json({ error: "Missing file or placeId" }, { status: 400 });

  const place = await prisma.place.findUnique({ where: { id: placeId } });
  if (!place) return NextResponse.json({ error: "Place not found" }, { status: 404 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadImageToCloudinary(buffer, place.slug);

  const existingCount = await prisma.placeMedia.count({ where: { placeId } });

  const media = await prisma.placeMedia.create({
    data: {
      placeId,
      cloudinaryId: uploaded.cloudinaryId,
      url: uploaded.url,
      width: uploaded.width,
      height: uploaded.height,
      order: existingCount,
      isHero: existingCount === 0, // first uploaded photo becomes the hero image by default
      license: "business-submitted",
    },
  });

  await prisma.place.update({
    where: { id: placeId },
    data: { imageStatus: "COMPLETE" },
  });

  return NextResponse.json({ media });
}
