import Link from "next/link";
import Image from "next/image";
import { CATEGORY_CONFIG } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";
import type { PlaceCategory } from "@prisma/client";

export type PlaceCardData = {
  slug: string;
  name: string;
  category: PlaceCategory;
  cityName?: string | null;
  countryName: string;
  heroImageUrl?: string | null;
  summarySnippet?: string | null;
};

export function PlaceCard({ place }: { place: PlaceCardData }) {
  const config = CATEGORY_CONFIG[place.category];
  const href = `/${config.slug}/${place.slug}`;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-lg border border-border bg-surface transition-transform hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/3] bg-surface-raised">
        {place.heroImageUrl ? (
          <Image
            src={place.heroImageUrl}
            alt={place.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">No photo yet</div>
        )}
        <Badge tone="gold" className="absolute left-3 top-3">{config.label}</Badge>
      </div>
      <div className="p-4 space-y-1">
        <h3 className="font-display text-base leading-snug">{place.name}</h3>
        <p className="text-xs text-muted">{[place.cityName, place.countryName].filter(Boolean).join(", ")}</p>
        {place.summarySnippet && (
          <p className="text-sm text-muted line-clamp-2 pt-1">{place.summarySnippet}</p>
        )}
      </div>
    </Link>
  );
}
