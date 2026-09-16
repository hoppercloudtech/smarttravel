import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/tiktok/crypto"; // same AES-256-GCM helper, no need to duplicate
import { refreshSearchConsoleToken } from "@/lib/searchconsole/client";
import type { SearchConsoleAccount } from "@prisma/client";

export async function getValidSearchConsoleToken(account: SearchConsoleAccount): Promise<string> {
    const expiringSoon = account.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (!expiringSoon) return decryptToken(account.accessTokenEnc);

    const refreshed = await refreshSearchConsoleToken(decryptToken(account.refreshTokenEnc));
    await prisma.searchConsoleAccount.update({
        where: { id: account.id },
        data: { accessTokenEnc: encryptToken(refreshed.access_token), expiresAt: new Date(Date.now() + refreshed.expires_in * 1000) },
    });
    return refreshed.access_token;
}