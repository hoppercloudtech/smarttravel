"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";

type Video = { videoId: string; title: string; channelTitle: string | null; thumbnailUrl: string };

export function VideoCarousel({ videos, placeName }: { videos: Video[]; placeName: string }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(false);
    const [playing, setPlaying] = useState<Video | null>(null);

    // Arrows only appear when the cards actually overflow (i.e. there are
    // more videos than fit), and each hides at its end of the track.
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
    }, [updateArrows, videos.length]);

    useEffect(() => {
        if (!playing) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(null);
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [playing]);

    function scrollBy(dir: 1 | -1) {
        const el = trackRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
    }

    if (videos.length === 0) return null;

    return (
        <section aria-label={`Videos about ${placeName}`}>
            <h2 className="font-display text-2xl mb-3">Videos</h2>

            <div className="relative">
                <div
                    ref={trackRef}
                    onScroll={updateArrows}
                    className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth pb-1"
                >
                    {videos.map((v) => (
                        <button
                            key={v.videoId}
                            type="button"
                            onClick={() => setPlaying(v)}
                            className="group w-64 sm:w-72 shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-surface text-left transition-colors hover:border-gold/50"
                        >
                            <div className="relative aspect-video bg-surface-raised">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={v.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
                                    <span className="rounded-full bg-background/80 p-3 backdrop-blur">
                                        <Play className="h-5 w-5 fill-current" />
                                    </span>
                                </span>
                            </div>
                            <div className="p-3">
                                <div className="line-clamp-2 text-sm font-medium">{v.title}</div>
                                {v.channelTitle && <div className="mt-1 truncate text-xs text-muted">{v.channelTitle}</div>}
                            </div>
                        </button>
                    ))}
                </div>

                {canLeft && (
                    <button
                        type="button"
                        aria-label="Scroll videos left"
                        onClick={() => scrollBy(-1)}
                        className="absolute left-2 top-[35%] -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur shadow"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                )}
                {canRight && (
                    <button
                        type="button"
                        aria-label="Scroll videos right"
                        onClick={() => scrollBy(1)}
                        className="absolute right-2 top-[35%] -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur shadow"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                )}
            </div>

            {playing && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={playing.title}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setPlaying(null)}
                >
                    <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-2 flex items-start justify-between gap-4">
                            <p className="line-clamp-2 text-sm text-white">{playing.title}</p>
                            <button
                                type="button"
                                aria-label="Close video"
                                onClick={() => setPlaying(null)}
                                className="shrink-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                            <iframe
                                src={`https://www.youtube-nocookie.com/embed/${playing.videoId}?autoplay=1&rel=0`}
                                title={playing.title}
                                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                allowFullScreen
                                className="h-full w-full"
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}