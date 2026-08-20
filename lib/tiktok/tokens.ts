// lib/tiktok/tokens.ts
//
// Ensures a TikTokAccount has a currently-valid access token, refreshing and
// re-encrypting it if it's expired or close to expiring. Every publish
// action should go through this rather than reading accessTokenEnc directly.

import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/tiktok/crypto";
import { refreshAccessToken } from "@/lib/tiktok/client";
import type { TikTokAccount } from "@prisma/client";

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh if expiring within 5 minutes

export async function getValidAccessToken(account: TikTokAccount): Promise<string> {
    const isExpiringSoon = account.expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;

    if (!isExpiringSoon) {
        return decryptToken(account.accessTokenEnc);
    }

    const refreshToken = decryptToken(account.refreshTokenEnc);

    try {
        const refreshed = await refreshAccessToken(refreshToken);

        await prisma.tikTokAccount.update({
            where: { id: account.id },
            data: {
                accessTokenEnc: encryptToken(refreshed.access_token),
                refreshTokenEnc: encryptToken(refreshed.refresh_token),
                expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
                refreshExpiresAt: new Date(Date.now() + refreshed.refresh_expires_in * 1000),
                scope: refreshed.scope,
                status: "ACTIVE",
            },
        });

        return refreshed.access_token;
    } catch (err) {
        // Refresh token itself has likely expired/been revoked — mark the
        // account so the dashboard can prompt a reconnect rather than silently
        // failing every publish attempt from here on.
        await prisma.tikTokAccount.update({ where: { id: account.id }, data: { status: "EXPIRED" } });
        throw new Error(
            `TikTok account token refresh failed — the account needs to be reconnected. Original error: ${err instanceof Error ? err.message : String(err)}`
        );
    }
}