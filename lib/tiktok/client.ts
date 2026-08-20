// lib/tiktok/client.ts
//
// TikTok Content Posting API client — OAuth, creator info, and photo-carousel
// publishing. Built against TikTok's documented Content Posting API as of
// mid-2026 (verified via search before writing this, not from training-data
// memory, since the API surface changes and the project brief explicitly
// requires verification).
//
// TWO THINGS TO KNOW BEFORE THIS WORKS IN PRODUCTION:
//
// 1. UNAUDITED APPS ONLY PUBLISH PRIVATELY. Every post from an app that
//    hasn't passed TikTok's audit is forced to SELF_ONLY visibility,
//    regardless of what privacy_level you request. There is no parameter
//    that overrides this. Until you submit your app and it passes review,
//    "automatic publishing" in this system means "automatically publishes,
//    visible only to the connected account." TikTokAccount.isAudited
//    tracks this — the admin dashboard should surface it prominently so
//    nobody's confused about why posts aren't public yet.
//
// 2. IMAGE URLS MUST COME FROM A TIKTOK-VERIFIED DOMAIN. publishPhotoCarousel
//    uses source: "PULL_FROM_URL", which requires you to verify domain
//    ownership of whatever host serves the images, in the TikTok for
//    Developers portal (Settings → URL Properties). Cloudinary's
//    res.cloudinary.com is not a domain you can verify ownership of.
//    Practical fix: proxy your Cloudinary images through your own verified
//    domain (e.g. https://horizonspot.site/api/media-proxy/[...]) so the
//    URL TikTok pulls from is one you actually own. A stub for that proxy
//    route is NOT included here — add it before this goes live, or
//    publishPhotoCarousel will fail at the TikTok end with a domain error.

const TIKTOK_AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function buildAuthorizeUrl(state: string): string {
    const clientKey = requireEnv("TIKTOK_CLIENT_KEY");
    const redirectUri = requireEnv("TIKTOK_REDIRECT_URI");

    const params = new URLSearchParams({
        client_key: clientKey,
        scope: "video.publish,user.info.basic",
        response_type: "code",
        redirect_uri: redirectUri,
        state,
    });

    return `${TIKTOK_AUTH_BASE}?${params}`;
}

export type TokenResponse = {
    access_token: string;
    expires_in: number; // seconds
    refresh_token: string;
    refresh_expires_in: number; // seconds
    open_id: string;
    scope: string;
    token_type: string;
};

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
    const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
        body: new URLSearchParams({
            client_key: requireEnv("TIKTOK_CLIENT_KEY"),
            client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
            code,
            grant_type: "authorization_code",
            redirect_uri: requireEnv("TIKTOK_REDIRECT_URI"),
        }),
    });

    if (!res.ok) throw new Error(`TikTok token exchange failed (${res.status}): ${await res.text()}`);
    return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const res = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
        body: new URLSearchParams({
            client_key: requireEnv("TIKTOK_CLIENT_KEY"),
            client_secret: requireEnv("TIKTOK_CLIENT_SECRET"),
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });

    if (!res.ok) throw new Error(`TikTok token refresh failed (${res.status}): ${await res.text()}`);
    return res.json();
}

// ---------------------------------------------------------------------------
// Creator info — must be queried before every publish, per TikTok's
// requirement, to get the privacy levels this specific creator's account
// actually allows right now (these can change independent of your app).
// ---------------------------------------------------------------------------

export type CreatorInfo = {
    creator_username: string;
    creator_nickname: string;
    creator_avatar_url: string;
    privacy_level_options: string[];
    comment_disabled: boolean;
    duet_disabled: boolean;
    stitch_disabled: boolean;
    max_video_post_duration_sec: number;
};

export async function queryCreatorInfo(accessToken: string): Promise<CreatorInfo> {
    const res = await fetch(`${TIKTOK_API_BASE}/post/publish/creator_info/query/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    });

    if (!res.ok) throw new Error(`TikTok creator_info query failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.data;
}

/** Picks the most-public privacy level actually available to this creator right now. */
export function pickBestAvailablePrivacyLevel(options: string[]): string {
    const preferenceOrder = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"];
    for (const preferred of preferenceOrder) {
        if (options.includes(preferred)) return preferred;
    }
    return options[0] ?? "SELF_ONLY";
}

// ---------------------------------------------------------------------------
// Photo carousel publishing
// ---------------------------------------------------------------------------

export type PublishPhotoCarouselResult = {
    publishId: string;
};

export async function publishPhotoCarousel(opts: {
    accessToken: string;
    imageUrls: string[]; // must be on a TikTok-verified domain — see file header
    caption: string;
    privacyLevel: string;
}): Promise<PublishPhotoCarouselResult> {
    if (opts.imageUrls.length === 0) throw new Error("publishPhotoCarousel requires at least one image URL.");
    if (opts.imageUrls.length > 35) throw new Error("TikTok photo posts support at most 35 images.");

    const res = await fetch(`${TIKTOK_API_BASE}/post/publish/content/init/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            post_info: {
                // TikTok's naming is confusing: for photo posts, `description` is
                // the caption text shown on the post, not `title`.
                title: opts.caption.slice(0, 90),
                description: opts.caption,
                disable_comment: false,
                privacy_level: opts.privacyLevel,
                // TikTok's own auto-music-selection for photo posts — the real,
                // honest equivalent of "trending sound" for this content type. See
                // the file header for why we don't attach a custom track here.
                auto_add_music: true,
            },
            source_info: {
                source: "PULL_FROM_URL",
                photo_cover_index: 0,
                photo_images: opts.imageUrls,
            },
            post_mode: "DIRECT_POST",
            media_type: "PHOTO",
        }),
    });

    if (!res.ok) throw new Error(`TikTok publish init failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return { publishId: data.data.publish_id };
}

// ---------------------------------------------------------------------------
// Publish status polling
// ---------------------------------------------------------------------------

export type PublishStatus = "PROCESSING_DOWNLOAD" | "PROCESSING_UPLOAD" | "PUBLISH_COMPLETE" | "FAILED" | "SEND_TO_USER_INBOX";

export async function getPublishStatus(accessToken: string, publishId: string): Promise<{ status: PublishStatus; failReason?: string }> {
    const res = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ publish_id: publishId }),
    });

    if (!res.ok) throw new Error(`TikTok status fetch failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return { status: data.data.status, failReason: data.data.fail_reason };
}