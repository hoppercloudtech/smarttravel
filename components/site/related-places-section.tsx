"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlaceCard, type PlaceCardData } from "@/components/site/place-card";

// Small, horizontally-scrollable variant of the existing Nearby grid.
// Reuses PlaceCard directly (no duplicate card system) — links are plain
// <Link> elements from PlaceCard, so this stays fully crawlable and works
// without JS (arrows are a progressive-enhancement control; the list itself
// still scrolls via touch/trackpad/keyboard regardless).
export function RelatedPlacesSection({ places }: { places: PlaceCardData[] }) {
    const scrollerRef = useRef<HTMLUListElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    function updateArrowVisibility() {
        const el = scrollerRef.current;
        if (!el) return;
        const maxScroll = el.scrollWidth - el.clientWidth;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft < maxScroll - 4);
    }

    useEffect(() => {
        updateArrowVisibility();
        const el = scrollerRef.current;
        if (!el) return;

        el.addEventListener("scroll", updateArrowVisibility, { passive: true });
        const resizeObserver = new ResizeObserver(updateArrowVisibility);
        resizeObserver.observe(el);

        return () => {
            el.removeEventListener("scroll", updateArrowVisibility);
            resizeObserver.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [places.length]);

    if (places.length === 0) return null;

    function scrollByAmount(direction: 1 | -1) {
        const el = scrollerRef.current;
        if (!el) return;
        const cardWidth = el.firstElementChild?.clientWidth ?? 200;
        el.scrollBy({ left: direction * (cardWidth + 16) * 2, behavior: "smooth" });
    }

    return (
        <section className="mt-16" aria-labelledby="related-places-heading">
            <h2 id="related-places-heading" className="font-display text-2xl mb-6">
                Related Places
            </h2>

            <div className="relative">
                {canScrollLeft && (
                    <button
                        type="button"
                        onClick={() => scrollByAmount(-1)}
                        aria-label="Scroll related places left"
                        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 -translate-x-2 rounded-full border border-border bg-surface p-2 shadow-md hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                )}

                {canScrollRight && (
                    <button
                        type="button"
                        onClick={() => scrollByAmount(1)}
                        aria-label="Scroll related places right"
                        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-2 rounded-full border border-border bg-surface p-2 shadow-md hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                )}

                <ul
                    ref={scrollerRef}
                    className="flex list-none gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                >
                    {places.map((place) => (
                        <li key={place.slug} className="w-40 shrink-0 snap-start sm:w-48">
                            <PlaceCard place={place} />
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}