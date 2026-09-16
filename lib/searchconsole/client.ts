// lib/searchconsole/client.ts
//
// OAuth + Search Analytics query client. Same server-only, encrypted-token
// discipline as lib/tiktok/client.ts and lib/tiktok/crypto.ts — reuses the
// same encryptToken/decryptToken helpers rather than duplicating crypto
// logic.

const OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEARCH_CONSOLE_API = "https://www.googleapis.com/webmasters/v3";

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required env var: ${name}`);
    return value;
}

export function buildSearchConsoleAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
        client_id: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID"),
        redirect_uri: requireEnv("GOOGLE_SEARCH_CONSOLE_REDIRECT_URI"),
        response_type: "code",
        // Verify this scope name against Google's current OAuth docs before relying on it.
        scope: "https://www.googleapis.com/auth/webmasters.readonly",
        access_type: "offline",
        prompt: "consent",
        state,
    });
    return `${OAUTH_AUTHORIZE_URL}?${params}`;
}

export type SearchConsoleTokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

export async function exchangeSearchConsoleCode(code: string): Promise<SearchConsoleTokenResponse> {
    const res = await fetch(OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID"),
            client_secret: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"),
            code,
            grant_type: "authorization_code",
            redirect_uri: requireEnv("GOOGLE_SEARCH_CONSOLE_REDIRECT_URI"),
        }),
    });
    if (!res.ok) throw new Error(`Search Console token exchange failed (${res.status}): ${await res.text()}`);
    return res.json();
}

export async function refreshSearchConsoleToken(refreshToken: string): Promise<SearchConsoleTokenResponse> {
    const res = await fetch(OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_ID"),
            client_secret: requireEnv("GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET"),
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    if (!res.ok) throw new Error(`Search Console token refresh failed (${res.status}): ${await res.text()}`);
    return res.json();
}

export type SearchAnalyticsRow = {
    keys: string[]; // order matches the `dimensions` array requested
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
};

export async function querySearchAnalytics(opts: {
    accessToken: string;
    siteUrl: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;
    dimensions: string[];
}): Promise<SearchAnalyticsRow[]> {
    const res = await fetch(`${SEARCH_CONSOLE_API}/sites/${encodeURIComponent(opts.siteUrl)}/searchAnalytics/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${opts.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: opts.startDate, endDate: opts.endDate, dimensions: opts.dimensions, rowLimit: 5000 }),
    });
    if (!res.ok) throw new Error(`Search Analytics query failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.rows ?? [];
}