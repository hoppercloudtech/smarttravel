import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exchangeSearchConsoleCode } from "@/lib/searchconsole/client";
import { encryptToken } from "@/lib/tiktok/crypto";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.redirect(new URL("/admin/login", req.url));

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const storedState = req.cookies.get("gsc_oauth_state")?.value;
    if (!code || !state || state !== storedState) {
        return NextResponse.redirect(new URL("/admin/seo/search-console?error=invalid_state", req.url));
    }

    const token = await exchangeSearchConsoleCode(code);
    if (!token.refresh_token) {
        return NextResponse.redirect(new URL("/admin/seo/search-console?error=no_refresh_token", req.url));
    }

    await prisma.searchConsoleAccount.upsert({
        where: { siteUrl: process.env.SEARCH_CONSOLE_SITE_URL! },
        update: { accessTokenEnc: encryptToken(token.access_token), refreshTokenEnc: encryptToken(token.refresh_token), expiresAt: new Date(Date.now() + token.expires_in * 1000) },
        create: { siteUrl: process.env.SEARCH_CONSOLE_SITE_URL!, accessTokenEnc: encryptToken(token.access_token), refreshTokenEnc: encryptToken(token.refresh_token), expiresAt: new Date(Date.now() + token.expires_in * 1000) },
    });

    const response = NextResponse.redirect(new URL("/admin/seo/search-console?connected=1", req.url));
    response.cookies.delete("gsc_oauth_state");
    return response;
}