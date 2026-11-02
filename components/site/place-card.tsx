import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
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
  /** Saved YouTube thumbnail. When present it is shown instead of the photo. */
  videoThumbnailUrl?: string | null;
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
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-raised">
        {place.videoThumbnailUrl ? (
          <>
            {/* YouTube thumbnails are 4:3 with baked-in black bars; the scale crops them off */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={place.videoThumbnailUrl}
              alt={place.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full scale-[1.34] object-cover transition-transform duration-300 group-hover:scale-[1.42]"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-background/80 p-2.5 shadow backdrop-blur">
                <Play className="h-4 w-4 fill-current" />
              </span>
            </span>
          </>
        ) : place.heroImageUrl ? (
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
      <div className="p-3 sm:p-4 space-y-1">
        <h3 className="font-display text-base leading-snug">{place.name}</h3>
        <p className="text-xs text-muted">{[place.cityName, place.countryName].filter(Boolean).join(", ")}</p>
        {place.summarySnippet && (
          <p className="text-sm text-muted line-clamp-2 pt-1">{place.summarySnippet}</p>
        )}
      </div>
    </Link>
  );
}