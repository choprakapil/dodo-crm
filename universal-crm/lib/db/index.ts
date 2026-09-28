/**
 * Prisma Client Singleton
 *
 * In development, Next.js hot-reload creates new module instances on each
 * reload, which would exhaust the connection pool. We cache the client on
 * the global object to reuse the same instance across reloads.
 *
 * In production, module instances are stable, so we create once and export.
 *
 * ADR-015: Prisma 5.x
 * ADR-007: Tenant isolation enforced at repository layer, not here.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
