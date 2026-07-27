import type { NextAuthConfig } from "next-auth";

// Split out per Auth.js v5 middleware conventions: this file must stay
// edge-compatible (no Prisma/bcrypt here), the full config with the
// Credentials provider lives in auth.ts.
export const authConfig = {
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = request.nextUrl.pathname.startsWith("/admin");
      const isOnLogin = request.nextUrl.pathname.startsWith("/admin/login");

      if (isOnLogin) return true;
      if (isOnAdmin) return isLoggedIn;
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
