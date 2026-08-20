import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForToken } from "@/lib/tiktok/client";
import { encryptToken } from "@/lib/tiktok/crypto";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.redirect(new URL("/admin/login", req.url));

    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const storedState = req.cookies.get("tiktok_oauth_state")?.value;

    if (!code || !state || !storedState || state !== storedState) {
        return NextResponse.redirect(new URL("/admin/tiktok/settings?error=invalid_oauth_state", req.url));
    }

    try {
        const token = await exchangeCodeForToken(code);

        const account = await prisma.tikTokAccount.upsert({
            where: { openId: token.open_id },
            update: {
                accessTokenEnc: encryptToken(token.access_token),
                refreshTokenEnc: encryptToken(token.refresh_token),
                scope: token.scope,
                expiresAt: new Date(Date.now() + token.expires_in * 1000),
                refreshExpiresAt: new Date(Date.now() + token.refresh_expires_in * 1000),
                status: "ACTIVE",
            },
            create: {
                openId: token.open_id,
                accessTokenEnc: encryptToken(token.access_token),
                refreshTokenEnc: encryptToken(token.refresh_token),
                scope: token.scope,
                expiresAt: new Date(Date.now() + token.expires_in * 1000),
                refreshExpiresAt: new Date(Date.now() + token.refresh_expires_in * 1000),
                status: "ACTIVE",
            },
        });

        // Every account needs a settings row before the queue builder can run —
        // create sensible defaults on first connect so the dashboard isn't
        // broken until someone visits Settings manually.
        await prisma.tikTokPostingSettings.upsert({
            where: { accountId: account.id },
            update: {},
            create: { accountId: account.id },
        });

        const response = NextResponse.redirect(new URL("/admin/tiktok?connected=1", req.url));
        response.cookies.delete("tiktok_oauth_state");
        return response;
    } catch (err) {
        console.error("TikTok OAuth callback failed", err);
        return NextResponse.redirect(new URL("/admin/tiktok/settings?error=oauth_failed", req.url));
    }
}