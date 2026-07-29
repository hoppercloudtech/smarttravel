import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteImageFromCloudinary } from "@/lib/cloudinary";
import { CATEGORY_CONFIG } from "@/lib/categories";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const media = await prisma.placeMedia.findUnique({
        where: { id: params.id },
        include: { place: true },
    });
    if (!media) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

    // Remove the actual asset from Cloudinary, not just the database row —
    // otherwise storage keeps accumulating orphaned files.
    await deleteImageFromCloudinary(media.cloudinaryId);
    await prisma.placeMedia.delete({ where: { id: params.id } });

    const remaining = await prisma.placeMedia.findMany({
        where: { placeId: media.placeId },
        orderBy: { order: "asc" },
    });

    if (media.isHero && remaining.length > 0) {
        // Promote the next photo in order to hero so the place page never ends
        // up with photos but no hero image.
        await prisma.placeMedia.update({ where: { id: remaining[0].id }, data: { isHero: true } });
    }

    await prisma.place.update({
        where: { id: media.placeId },
        data: { imageStatus: remaining.length > 0 ? "COMPLETE" : "PENDING" },
    });

    revalidatePath(`/${CATEGORY_CONFIG[media.place.category].slug}/${media.place.slug}`);

    return NextResponse.json({ ok: true, remainingCount: remaining.length });
}