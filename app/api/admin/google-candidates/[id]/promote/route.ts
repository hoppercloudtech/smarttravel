import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSlug } from "@/lib/utils";

// This is the ONLY path by which a Google-discovered place becomes a real,
// public Place row — and it requires the admin to submit confirmed field
// values (even if the form was pre-filled from the candidate as a starting
// point). We never silently copy Google's raw content into a published
// listing.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const candidate = await prisma.googlePlaceCandidate.findUnique({ where: { id: params.id } });
    if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    if (candidate.status !== "NEW") {
        return NextResponse.json({ error: `Candidate already ${candidate.status.toLowerCase()}.` }, { status: 409 });
    }

    const body = await req.json();
    if (!body.name || !body.category || !body.countryId) {
        return NextResponse.json({ error: "name, category, and countryId are required to promote a candidate." }, { status: 400 });
    }

    const baseSlug = toSlug(body.name);
    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.place.findUnique({ where: { slug } })) slug = `${baseSlug}-${++suffix}`;

    const place = await prisma.place.create({
        data: {
            name: body.name,
            slug,
            category: body.category,
            status: "DRAFT", // still requires an explicit publish from the normal editor
            countryId: body.countryId,
            cityId: body.cityId || null,
            district: body.district || null,
            address: body.address || null,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
            googlePlaceId: candidate.googlePlaceId,
            coordinatesSource: candidate.provider,
            provider: candidate.provider,
            coordinatesCachedAt: new Date(),
            description: body.description || null,
            amenities: body.amenities ?? [],
            source: candidate.source,
            createdById: (session.user as any).id,
            updatedById: (session.user as any).id,
        },
    });

    await prisma.googlePlaceCandidate.update({
        where: { id: candidate.id },
        data: { status: "PROMOTED", promotedPlaceId: place.id, reviewedAt: new Date() },
    });

    return NextResponse.json({ place });
}