import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils";

export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const landmarks = await prisma.landmark.findMany({ include: { country: true, city: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ landmarks });
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const landmark = await prisma.landmark.create({
        data: {
            name: body.name,
            slug: toSlug(body.name),
            type: body.type,
            latitude: body.latitude,
            longitude: body.longitude,
            countryId: body.countryId,
            cityId: body.cityId || null,
            radiusKm: body.radiusKm ?? 10,
        },
    });
    return NextResponse.json({ landmark });
}
export async function DELETE(req: NextRequest) {
    const session = await auth();

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!body.id) {
        return NextResponse.json(
            { error: "Landmark ID is required" },
            { status: 400 }
        );
    }

    try {
        await prisma.landmark.delete({
            where: {
                id: body.id,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete landmark:", error);

        return NextResponse.json(
            { error: "Failed to delete landmark" },
            { status: 500 }
        );
    }
}