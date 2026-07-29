// lib/wikimedia.ts
//
// Looks up a legally reusable photo for a place from Wikimedia Commons —
// deliberately the *only* image source this pipeline auto-attaches, because
// every file on Commons carries an explicit, checkable license
// (CC-BY / CC-BY-SA / CC0 / public domain), unlike scraping business photos
// from Google or social platforms. Coverage will be thin outside well-known
// landmarks — that's expected, not a bug.

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

export type CommonsImage = {
    url: string;
    descriptionUrl: string;
    license: string;
    artist?: string;
    width: number;
    height: number;
};

// Only accept clearly open licenses — reject anything ambiguous (e.g.
// "fair use", "all rights reserved", non-commercial-only) rather than guess.
const ACCEPTABLE_LICENSE_PATTERNS = [/^cc-by/i, /^cc0/i, /public domain/i, /^pd-/i];

function isAcceptableLicense(licenseShortName?: string): boolean {
    if (!licenseShortName) return false;
    return ACCEPTABLE_LICENSE_PATTERNS.some((re) => re.test(licenseShortName.trim()));
}

function stripHtml(value?: string): string | undefined {
    return value ? value.replace(/<[^>]+>/g, "").trim() : undefined;
}

async function commonsGet(params: Record<string, string>) {
    const url = `${COMMONS_API}?${new URLSearchParams({ ...params, format: "json", origin: "*" })}`;
    const res = await fetch(url, { headers: { "User-Agent": "SmartTravel/1.0" } });
    if (!res.ok) return null;
    return res.json();
}

/** Finds Commons files geotagged near a place's coordinates. */
async function geosearchFileTitles(lat: number, lon: number, radiusMeters = 300): Promise<string[]> {
    const data = await commonsGet({
        action: "query",
        list: "geosearch",
        gscoord: `${lat}|${lon}`,
        gsradius: String(radiusMeters),
        gsnamespace: "6", // File namespace
        gslimit: "5",
    });
    return (data?.query?.geosearch ?? []).map((r: { title: string }) => r.title);
}

/** Falls back to a plain text search by place name when geosearch finds nothing. */
async function searchFileTitlesByName(name: string): Promise<string[]> {
    const data = await commonsGet({
        action: "query",
        list: "search",
        srsearch: name,
        srnamespace: "6",
        srlimit: "5",
    });
    return (data?.query?.search ?? []).map((r: { title: string }) => r.title);
}

/** Fetches license + URL info for one Commons file title, rejecting anything not clearly open. */
async function fetchImageInfo(fileTitle: string): Promise<CommonsImage | null> {
    const data = await commonsGet({
        action: "query",
        titles: fileTitle,
        prop: "imageinfo",
        iiprop: "url|extmetadata|size",
    });

    const pages = data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    const info = page?.imageinfo?.[0];
    if (!info) return null;

    const license = info.extmetadata?.LicenseShortName?.value as string | undefined;
    if (!isAcceptableLicense(license)) return null;

    return {
        url: info.url,
        descriptionUrl: info.descriptionurl,
        license: license!,
        artist: stripHtml(info.extmetadata?.Artist?.value),
        width: info.width,
        height: info.height,
    };
}

/**
 * Finds one legally reusable image for a place: tries coordinates first
 * (most reliable — a geotagged photo taken *at* the place), then falls back
 * to a name search. Returns null if nothing openly licensed is found, which
 * is the common case for smaller businesses — the pipeline treats that as a
 * normal "skipped", not a failure.
 */
export async function findCommonsImage(opts: {
    name: string;
    latitude?: number;
    longitude?: number;
}): Promise<CommonsImage | null> {
    let titles: string[] = [];

    if (opts.latitude != null && opts.longitude != null) {
        titles = await geosearchFileTitles(opts.latitude, opts.longitude);
    }

    if (titles.length === 0) {
        titles = await searchFileTitlesByName(opts.name);
    }

    for (const title of titles) {
        const info = await fetchImageInfo(title);
        if (info) return info;
    }

    return null;
}