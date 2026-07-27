import { prisma } from "@/lib/prisma";
import { PlaceForm } from "@/components/admin/place-form";

export default async function NewPlacePage() {
  const countries = await prisma.country.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Add a place</h1>
        <p className="text-sm text-muted mt-1">
          Fill in the structured facts — the AI summary is generated from exactly what you enter here.
        </p>
      </div>
      <PlaceForm countries={countries} />
    </div>
  );
}
