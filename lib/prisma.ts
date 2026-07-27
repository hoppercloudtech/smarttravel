import { PrismaClient } from "@prisma/client";

// Prevents exhausting Neon's connection limit during Next.js dev hot-reload
// by reusing a single PrismaClient instance across module reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
