// lib/tiktok/publisher.ts
//
// Publishing is split into two fast, idempotent steps rather than one call
// that blocks until TikTok finishes processing:
//   1. attemptPublish  — sends the init request, stores the publish_id, sets
//      status PUBLISHING. Returns almost immediately.
//   2. pollInFlightPublishes — checks status on anything still PUBLISHING and
//      finalizes it to PUBLISHED or FAILED. Meant to run on every cron tick.
// This matters because TikTok's server has to download every image before a
// post finishes processing, which can take longer than a serverless
// function's request timeout — polling separately avoids that failure mode
// entirely.

import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/tiktok/tokens";
import { queryCreatorInfo, pickBestAvailablePrivacyLevel, publishPhotoCarousel, getPublishStatus } from "@/lib/tiktok/client";

const MAX_ATTEMPTS = 3;

export async function attemptPublish(postId: string): Promise<void> {
    const post = await prisma.tikTokPost.findUniqueOrThrow({
        where: { id: postId },
        include: { account: true },
    });

    const log = (event: string, message?: string) =>
        prisma.tikTokPublishingLog.create({ data: { postId: post.id, event, message } });

    if (post.attemptCount >= MAX_ATTEMPTS) {
        await prisma.tikTokPost.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: "Max retry attempts reached." } });
        await log("publish_failed", "Max retry attempts reached — needs manual review.");
        return;
    }

    const mediaUrls = post.mediaUrls as unknown as string[];
    if (mediaUrls.length === 0) {
        await prisma.tikTokPost.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: "No images attached to this post." } });
        await log("validation_failed", "No images attached — this should not happen if the queue builder ran correctly.");
        return;
    }

    try {
        await prisma.tikTokPost.update({ where: { id: post.id }, data: { status: "PUBLISHING", attemptCount: { increment: 1 } } });
        await log("publish_attempt", `Attempt ${post.attemptCount + 1} of ${MAX_ATTEMPTS}.`);

        const accessToken = await getValidAccessToken(post.account);
        const creatorInfo = await queryCreatorInfo(accessToken);
        const privacyLevel = pickBestAvailablePrivacyLevel(creatorInfo.privacy_level_options);

        const fullCaption = [post.caption, (post.hashtags as unknown as string[]).map((h) => `#${h}`).join(" ")]
            .filter(Boolean)
            .join("\n\n");

        const result = await publishPhotoCarousel({
            accessToken,
            imageUrls: mediaUrls,
            caption: fullCaption,
            privacyLevel,
        });

        await prisma.tikTokPost.update({
            where: { id: post.id },
            data: { tiktokPublishId: result.publishId },
        });

        await log(
            "publish_attempt",
            post.account.isAudited
                ? `Submitted to TikTok, publish_id=${result.publishId}.`
                : `Submitted to TikTok, publish_id=${result.publishId}. NOTE: this account is not yet audited, so this post will be private (SELF_ONLY) regardless of the requested privacy level.`
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await prisma.tikTokPost.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: message } });
        await log("publish_failed", message);
    }
}

/** Checks every post still in PUBLISHING and finalizes its status. Call this on every cron tick. */
export async function pollInFlightPublishes(): Promise<{ checked: number; completed: number; failed: number }> {
    const inFlight = await prisma.tikTokPost.findMany({
        where: { status: "PUBLISHING", tiktokPublishId: { not: null } },
        include: { account: true },
    });

    let completed = 0;
    let failed = 0;

    for (const post of inFlight) {
        try {
            const accessToken = await getValidAccessToken(post.account);
            const { status, failReason } = await getPublishStatus(accessToken, post.tiktokPublishId!);

            if (status === "PUBLISH_COMPLETE") {
                await prisma.tikTokPost.update({ where: { id: post.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
                await prisma.tikTokPublishingLog.create({ data: { postId: post.id, event: "publish_success" } });
                completed++;
            } else if (status === "FAILED") {
                await prisma.tikTokPost.update({ where: { id: post.id }, data: { status: "FAILED", errorMessage: failReason ?? "TikTok reported a failure with no reason given." } });
                await prisma.tikTokPublishingLog.create({ data: { postId: post.id, event: "publish_failed", message: failReason ?? undefined } });
                failed++;
            }
            // Otherwise still processing — leave as PUBLISHING, check again next tick.
        } catch (err) {
            // Don't flip to FAILED on a transient polling error — leave it
            // PUBLISHING and let the next tick retry the status check itself.
            await prisma.tikTokPublishingLog.create({
                data: { postId: post.id, event: "publish_attempt", message: `Status check failed (will retry): ${err instanceof Error ? err.message : String(err)}` },
            });
        }
    }

    return { checked: inFlight.length, completed, failed };
}