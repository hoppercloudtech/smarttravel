export { auth as middleware } from "@/auth";

export const config = {
  // Protect everything under /admin except the login page (handled in
  // auth.config.ts's `authorized` callback) and skip static assets / API auth routes.
  matcher: ["/admin/:path*"],
};
