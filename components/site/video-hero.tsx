"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

type Video = { videoId: string; title: string; thumbnailUrl: string };

// The big 16:9 area. Keyed by videoId from the parent, so picking another video
// resets it cleanly. The YouTube player is only loaded after a tap.
function Stage({ video, playing, onPlay }: { video: Video; playing: boolean; onPlay: () => void }) {
    // Try the sharp 16:9 thumbnail first, fall back to the saved one if it doesn't exist.
    const [src, setSrc] = useState(`https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`);
    const [thumbFailed, setThumbFailed] = useState(false);

    function onThumbError() {
        if (src !== video.thumbnailUrl) setSrc(video.thumbnailUrl);
        else setThumbFailed(true);
    }

    return (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface-raised">
            {playing ? (
                <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0&playsinline=1`}
                    title={video.title}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                />
            ) : (
                <button
                    type="button"
                    onClick={onPlay}
                    aria-label={`Play video: ${video.title}`}
                    className="group absolute inset-0 block h-full w-full"
                >
                    {!thumbFailed && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={src}
                            alt=""
                            fetchPriority="high"
                            decoding="async"
                            onError={onThumbError}
                            onLoad={(e) => {
                                // YouTube serves a tiny grey placeholder when maxres doesn't exist
                                if (e.currentTarget.naturalWidth < 400 && src !== video.thumbnailUrl) setSrc(video.thumbnailUrl);
                            }}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background/85 shadow-lg backdrop-blur transition-transform group-hover:scale-105 sm:h-20 sm:w-20">
                            <Play className="h-6 w-6 fill-current sm:h-8 sm:w-8" />
                        </span>
                    </span>
                </button>
            )}
        </div>
    );
}

// Main visual of a place page: one big video, and the other saved videos as
// cards underneath. Tapping a card makes it the main video and plays it.
export function VideoHero({ videos, placeName }: { videos: Video[]; placeName: string }) {
    const [activeId, setActiveId] = useState<string | undefined>(videos[0]?.videoId);
    const [playing, setPlaying] = useState(false);
    const stageRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const [canLeft, setCanLeft] = useState(false);
    const [canRight, setCanRight] = useState(false);

    const active = videos.find((v) => v.videoId === activeId) ?? videos[0];
    const others = active ? videos.filter((v) => v.videoId !== active.videoId) : [];

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
    }, [updateArrows, others.length]);

    function scrollBy(dir: 1 | -1) {
        const el = trackRef.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
    }

    function pick(v: Video) {
        setActiveId(v.videoId);
        setPlaying(true); // user tapped, so playing right away is expected
        stageRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    if (!active) return null;

    return (
        <section aria-label={`Videos of ${placeName}`} className="space-y-4">
            <div ref={stageRef} className="scroll-mt-20 space-y-3">
                <Stage key={active.videoId} video={active} playing={playing} onPlay={() => setPlaying(true)} />
                <p className="line-clamp-2 text-sm font-medium">{active.title}</p>
            </div>

            {others.length > 0 && (
                <div>
                    <h2 className="mb-2 font-display text-lg">More videos</h2>
                    <div className="relative">
                        <div
                            ref={trackRef}
                            onScroll={updateArrows}
                            className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1"
                        >
                            {others.map((v) => (
                                <button
                                    key={v.videoId}
                                    type="button"
                                    onClick={() => pick(v)}
                                    aria-label={`Play ${v.title}`}
                                    className="group w-44 shrink-0 snap-start text-left sm:w-56"
                                >
                                    <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-surface-raised transition-colors group-hover:border-gold/50">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={v.thumbnailUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover:bg-black/30">
                                            <span className="rounded-full bg-background/80 p-1.5 backdrop-blur">
                                                <Play className="h-3.5 w-3.5 fill-current" />
                                            </span>
                                        </span>
                                    </div>
                                    <p className="mt-1.5 line-clamp-2 text-xs">{v.title}</p>
                                </button>
                            ))}
                        </div>

                        {canLeft && (
                            <button
                                type="button"
                                aria-label="Scroll videos left"
                                onClick={() => scrollBy(-1)}
                                className="absolute left-1 top-[30%] -translate-y-1/2 rounded-full bg-background/80 p-2 shadow backdrop-blur"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                        )}
                        {canRight && (
                            <button
                                type="button"
                                aria-label="Scroll videos right"
                                onClick={() => scrollBy(1)}
                                className="absolute right-1 top-[30%] -translate-y-1/2 rounded-full bg-background/80 p-2 shadow backdrop-blur"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}