import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { buildSearchConsoleAuthorizeUrl } from "@/lib/searchconsole/client";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.redirect(new URL("/admin/login", req.url));

    const state = randomBytes(16).toString("hex");
    const response = NextResponse.redirect(buildSearchConsoleAuthorizeUrl(state));
    response.cookies.set("gsc_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
    return response;
}