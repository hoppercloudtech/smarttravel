"use client";

import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";

type Video = { videoId: string; title: string; channelTitle: string | null; thumbnailUrl: string };

// Main visual of a place page. Shows the thumbnail; the YouTube player is only
// loaded after the visitor taps play (no player cost on page load, no autoplay
// with sound before a tap).
export function VideoHero({ video, placeName }: { video: Video; placeName: string }) {
    const [playing, setPlaying] = useState(false);
    // Try the sharp 16:9 thumbnail first, fall back to the saved one if it doesn't exist.
    const [src, setSrc] = useState(`https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`);
    const [thumbFailed, setThumbFailed] = useState(false);
    const watchUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

    function onThumbError() {
        if (src !== video.thumbnailUrl) setSrc(video.thumbnailUrl);
        else setThumbFailed(true);
    }

    return (
        <section aria-label={`Video of ${placeName}`} className="space-y-3">
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
                        onClick={() => setPlaying(true)}
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

            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
                    {video.channelTitle && <p className="truncate text-xs text-muted">{video.channelTitle} · YouTube</p>}
                </div>
                <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-gold-soft hover:underline"
                >
                    Watch on YouTube <ExternalLink className="h-3 w-3" />
                </a>
            </div>
        </section>
    );
}