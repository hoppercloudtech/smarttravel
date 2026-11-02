"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Photo = { url: string; altText: string | null; license: string | null; sourceUrl: string | null };

// Wikimedia Commons photos require visible credit; business-submitted ones don't.
function credit(p: Photo): { label: string; href: string | null } | null {
    if (!p.license || !p.license.toLowerCase().startsWith("wikimedia")) return null;
    const lic = p.license.replace(/^wikimedia-/i, "").toUpperCase();
    return { label: `Wikimedia Commons · ${lic}`, href: p.sourceUrl };
}

export function PhotoCarousel({ photos, placeName }: { photos: Photo[]; placeName: string }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(false);
    const [open, setOpen] = useState<number | null>(null);

    const updateArrows = useCallback(() => {
        const el = trackRef.current;
        if (!el) return;
        setCanLeft(el.scrollLeft > 4);
        setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    useEffect(() => {
        updateArrows();
        window.addEventListener("resize", updateArrows);
        return () => window.removeEventListener("resize", updateArrows);
    }, [updateArrows, photos.length]);

    useEffect(() => {
        if (open === null) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open]);

    function scrollBy(dir: 1 | -1) {
        const el = trackRef.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
    }

    if (photos.length === 0) return null;
    const active = open !== null ? photos[open] : null;
    const activeCredit = active ? credit(active) : null;

    return (
        <section aria-label={`Photos of ${placeName}`}>
            <h2 className="font-display text-2xl mb-3">Photos</h2>

            <div className="relative">
                <div
                    ref={trackRef}
                    onScroll={updateArrows}
                    className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pb-1 sm:gap-4"
                >
                    {photos.map((p, i) => {
                        const c = credit(p);
                        return (
                            <div key={p.url} className="w-60 shrink-0 snap-start sm:w-72">
                                <button
                                    type="button"
                                    onClick={() => setOpen(i)}
                                    aria-label={`Open photo ${i + 1} of ${photos.length}`}
                                    className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-surface-raised transition-colors hover:border-gold/50"
                                >
                                    <Image
                                        src={p.url}
                                        alt={p.altText || `${placeName} photo ${i + 1}`}
                                        fill
                                        sizes="(max-width: 640px) 240px, 288px"
                                        className="object-cover"
                                    />
                                </button>
                                {c && (
                                    <p className="mt-1 truncate text-[11px] text-muted">
                                        {c.href ? (
                                            <a href={c.href} target="_blank" rel="noopener noreferrer" className="hover:text-gold-soft hover:underline">
                                                {c.label}
                                            </a>
                                        ) : (
                                            c.label
                                        )}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {canLeft && (
                    <button
                        type="button"
                        aria-label="Scroll photos left"
                        onClick={() => scrollBy(-1)}
                        className="absolute left-1 top-[40%] -translate-y-1/2 rounded-full bg-background/80 p-2 shadow backdrop-blur sm:left-2"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                )}
                {canRight && (
                    <button
                        type="button"
                        aria-label="Scroll photos right"
                        onClick={() => scrollBy(1)}
                        className="absolute right-1 top-[40%] -translate-y-1/2 rounded-full bg-background/80 p-2 shadow backdrop-blur sm:right-2"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                )}
            </div>

            {active && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={active.altText || `${placeName} photo`}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6"
                    onClick={() => setOpen(null)}
                >
                    <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate text-xs text-white/80">
                                {activeCredit ? (
                                    activeCredit.href ? (
                                        <a href={activeCredit.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                            {activeCredit.label}
                                        </a>
                                    ) : (
                                        activeCredit.label
                                    )
                                ) : (
                                    placeName
                                )}
                            </p>
                            <button
                                type="button"
                                aria-label="Close photo"
                                onClick={() => setOpen(null)}
                                className="shrink-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="relative h-[70vh] w-full">
                            <Image
                                src={active.url}
                                alt={active.altText || `${placeName} photo`}
                                fill
                                sizes="(max-width: 1024px) 100vw, 896px"
                                className="object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}