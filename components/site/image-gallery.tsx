"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Img = { url: string; altText: string | null; width: number | null; height: number | null };

export function ImageGallery({ images, placeName }: { images: Img[]; placeName: string }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return (
      <div className="aspect-[16/9] w-full rounded-lg bg-surface-raised flex items-center justify-center text-muted text-sm">
        Photos coming soon
      </div>
    );
  }

  function go(delta: number) {
    setActive((prev) => Math.max(0, Math.min(images.length - 1, prev + delta)));
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-surface-raised">
        <Image
          src={images[active].url}
          alt={images[active].altText || `${placeName} photo ${active + 1}`}
          fill
          priority={active === 0}
          sizes="(max-width: 768px) 100vw, 900px"
          className="object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              aria-label="Previous photo"
              onClick={() => go(-1)}
              disabled={active === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 backdrop-blur disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Next photo"
              onClick={() => go(1)}
              disabled={active === images.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-2 backdrop-blur disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div ref={trackRef} className="flex gap-2 overflow-x-auto no-scrollbar">
          {images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                i === active ? "border-gold" : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <Image src={img.url} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
