import { prisma } from "@/lib/prisma";
import { querySearchAnalytics } from "@/lib/searchconsole/client";
import { getValidSearchConsoleToken } from "@/lib/searchconsole/tokens";

export async function syncSearchPerformance(daysBack = 3) {
    const account = await prisma.searchConsoleAccount.findFirst();
    if (!account) return { synced: 0, reason: "No Search Console account connected." };

    const accessToken = await getValidSearchConsoleToken(account);
    const endDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // GSC data has a ~2 day lag
    const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const rows = await querySearchAnalytics({
        accessToken,
        siteUrl: account.siteUrl,
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["query", "page", "country", "device", "date"],
    });

    let synced = 0;
    for (const row of rows) {
        const [query, page, country, device, date] = row.keys;
        await prisma.searchPerformanceRecord.upsert({
            where: { query_page_country_device_date: { query, page, country, device, date: new Date(date) } },
            update: { impressions: row.impressions, clicks: row.clicks, ctr: row.ctr, averagePosition: row.position },
            create: { query, page, country, device, date: new Date(date), impressions: row.impressions, clicks: row.clicks, ctr: row.ctr, averagePosition: row.position },
        });
        synced++;
    }

    await prisma.searchConsoleAccount.update({ where: { id: account.id }, data: { lastSyncedAt: new Date() } });
    console.log(`[SearchConsole] Synced ${synced} rows.`);
    return { synced };
}