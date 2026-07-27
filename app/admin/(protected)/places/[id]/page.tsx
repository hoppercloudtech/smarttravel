import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlaceForm } from "@/components/admin/place-form";

export default async function EditPlacePage({ params }: { params: { id: string } }) {
  const [place, countries] = await Promise.all([
    prisma.place.findUnique({
      where: { id: params.id },
      include: { media: { orderBy: { order: "asc" } }, summaries: { where: { isCurrent: true }, take: 1 } },
    }),
    prisma.country.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!place) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">{place.name}</h1>
        <p className="text-sm text-muted mt-1">/{place.category.toLowerCase()}/{place.slug}</p>
      </div>
      <PlaceForm
        countries={countries}
        initial={{
          id: place.id,
          name: place.name,
          category: place.category,
          countryId: place.countryId,
          cityId: place.cityId,
          district: place.district,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          googleMapsUrl: place.googleMapsUrl,
          website: place.website,
          phone: place.phone,
          email: place.email,
          amenities: (place.amenities as string[]) ?? [],
          description: place.description,
          status: place.status,
          featured: place.featured,
        }}
        initialMedia={place.media.map((m) => ({ id: m.id, url: m.url, isHero: m.isHero }))}
        initialSummary={place.summaries[0]?.content}
      />
    </div>
  );
}
