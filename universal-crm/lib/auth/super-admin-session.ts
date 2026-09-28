/**
 * Super Admin Authentication & Session Management
 *
 * Implements strict platform-level administrative boundary:
 * Super Admin Session -> Super Admin Identity -> Platform Authorization.
 * Zero companyId context; zero crossover with tenant User sessions.
 */

import { prisma } from "@/lib/db";
import { hashToken, generateSecureToken } from "@/lib/utils/tokens";
import { UnauthorizedError } from "@/lib/errors";
import {
  getSuperAdminSessionToken,
  setSuperAdminSessionCookie,
  clearSuperAdminSessionCookie,
  SESSION_MAX_AGE_SECONDS,
} from "./cookies";
import { NextRequest } from "next/server";
import { setTraceContext, initRequestContext } from "@/lib/observability/context";

export interface SuperAdminUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  role: "SUPER_ADMIN"; // Extensible for future platform roles (e.g., PLATFORM_SUPPORT)
}

export interface SuperAdminContext {
  superAdmin: SuperAdminUser;
  session: {
    id: string;
    expiresAt: Date;
  };
}

/**
 * Creates a database-backed session for an authenticated Super Admin.
 * Raw 32-byte token is returned for client cookie setting; SHA-256 hash is saved to DB.
 */
export async function createSuperAdminSession(
  superAdminId: string,
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<{ rawToken: string; expiresAt: Date; sessionId: string }> {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const session = await prisma.superAdminSession.create({
    data: {
      superAdminId,
      tokenHash,
      expiresAt,
      userAgent: metadata?.userAgent?.slice(0, 500),
      ipAddress: metadata?.ipAddress?.slice(0, 100),
    },
  });

  return {
    rawToken,
    expiresAt,
    sessionId: session.id,
  };
}

/**
 * Validates a raw Super Admin session token against the database.
 * Checks expiration, active state, and soft-delete status.
 */
export async function validateSuperAdminSessionToken(
  rawToken: string
): Promise<SuperAdminContext | null> {
  if (!rawToken || typeof rawToken !== "string") {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  const session = await prisma.superAdminSession.findUnique({
    where: { tokenHash },
    include: {
      superAdmin: true,
    },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt <= new Date()) {
    prisma.superAdminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const { superAdmin } = session;

  // Check soft delete
  if (superAdmin.deletedAt !== null) {
    return null;
  }

  // Check active status
  if (!superAdmin.isActive) {
    return null;
  }

  return {
    superAdmin: {
      id: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      isActive: superAdmin.isActive,
      lastLoginAt: superAdmin.lastLoginAt,
      role: "SUPER_ADMIN",
    },
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  };
}

/**
 * Revokes a Super Admin session by raw token.
 */
export async function revokeSuperAdminSessionByToken(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.superAdminSession.deleteMany({
    where: { tokenHash },
  });
}

/**
 * Revokes all sessions for a Super Admin (e.g. on password change).
 */
export async function revokeAllSuperAdminSessions(superAdminId: string): Promise<void> {
  await prisma.superAdminSession.deleteMany({
    where: { superAdminId },
  });
}

/**
 * Retrieves the Super Admin context from the request cookie if valid, or null.
 */
export async function getSuperAdminContext(
  request?: NextRequest
): Promise<SuperAdminContext | null> {
  let token: string | null = null;

  if (request) {
    token = request.cookies.get("universal_crm_superadmin_session")?.value ?? null;
  } else {
    token = await getSuperAdminSessionToken();
  }

  if (!token) {
    return null;
  }

  return validateSuperAdminSessionToken(token);
}

/**
 * Enforces Super Admin authentication. Throws UnauthorizedError if not authenticated.
 */
export async function requireSuperAdmin(
  request?: NextRequest
): Promise<SuperAdminContext> {
  initRequestContext(request);
  const context = await getSuperAdminContext(request);
  if (!context) {
    throw new UnauthorizedError("Super Admin authentication required to access platform resources.");
  }
  setTraceContext({
    userId: context.superAdmin.id,
    isSuperAdmin: true,
  });
  return context;
}

export { setSuperAdminSessionCookie, clearSuperAdminSessionCookie };
