import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { buildAuthorizeUrl } from "@/lib/tiktok/client";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.redirect(new URL("/admin/login", req.url));

    const state = randomBytes(16).toString("hex");
    const response = NextResponse.redirect(buildAuthorizeUrl(state));

    // Short-lived, httpOnly state cookie — checked in the callback to guard
    // against CSRF on the OAuth redirect, standard practice for this flow.
    response.cookies.set("tiktok_oauth_state", state, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 600, // 10 minutes — plenty for the redirect round trip
        path: "/",
    });

    return response;
}