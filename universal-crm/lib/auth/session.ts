/**
 * Multi-Tenant Authentication & Session Management
 *
 * Implements DECISION-001: DB-backed HTTP-only sessions with instant revocation.
 * Enforces strict multi-tenant isolation:
 * Authentication -> User Identity -> Company/Tenant Context -> Role -> Permissions -> Data Scope.
 */

import { prisma } from "@/lib/db";
import { hashToken, generateSecureToken } from "@/lib/utils/tokens";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { getSessionToken, setSessionCookie, clearSessionCookie, SESSION_MAX_AGE_SECONDS } from "./cookies";
import { CompanyStatus, UserStatus, DataScope } from "@prisma/client";
import { NextRequest } from "next/server";
import { setTraceContext, initRequestContext } from "@/lib/observability/context";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: UserStatus;
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
}

export interface AuthCompany {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  timezone: string;
  currency: string;
  defaultCountryCode?: string;
  allowSalesPriceOverride?: boolean;
  customerDirectoryVisibility?: string;
  createEnquiryHistoryEnabled?: boolean;
  historyPreviewFields?: Record<string, boolean> | string[] | null;
}

export interface AuthPermission {
  module: string;
  action: string;
  dataScope: DataScope;
}

export interface AuthContext {
  user: AuthUser;
  company: AuthCompany;
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
  permissions: AuthPermission[];
  session: {
    id: string;
    expiresAt: Date;
  };
  hasPermission: (module: string, action: string) => boolean;
  getDataScope: (module: string, action: string) => DataScope | null;
}

/**
 * Creates a database-backed session for a verified user and company.
 * Raw token is returned for client cookie setting; SHA-256 hash is saved to database.
 */
export async function createDbSession(
  userId: string,
  companyId: string,
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<{ rawToken: string; expiresAt: Date; sessionId: string }> {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      companyId,
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
 * Validates a raw session token against the database.
 * Checks expiration, soft-delete status, user status, and company status.
 */
export async function validateSessionToken(rawToken: string): Promise<AuthContext | null> {
  if (!rawToken || typeof rawToken !== "string") {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
        },
      },
      company: true,
    },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt <= new Date()) {
    // Clean up expired session asynchronously
    prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const { user, company } = session;

  // Check user soft delete
  if (user.deletedAt !== null) {
    return null;
  }

  // Check user status
  if (user.status !== UserStatus.ACTIVE) {
    return null;
  }

  // Check company status
  if (company.status !== CompanyStatus.ACTIVE) {
    return null;
  }

  const permissions: AuthPermission[] = user.role.permissions.map(
    (p: { module: string; action: string; dataScope: DataScope }) => ({
      module: p.module,
      action: p.action,
      dataScope: p.dataScope,
    })
  );

  const hasPermission = (module: string, action: string): boolean => {
    return permissions.some(
      (p) =>
        (p.module === module || p.module === "*") &&
        (p.action === action || p.action === "*" || p.action === "manage")
    );
  };

  const getDataScope = (module: string, action: string): DataScope | null => {
    const match = permissions.find(
      (p) =>
        (p.module === module || p.module === "*") &&
        (p.action === action || p.action === "*" || p.action === "manage")
    );
    return match ? match.dataScope : null;
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      status: user.status,
      roleId: user.roleId,
      roleName: user.role.name,
      isSystemRole: user.role.isSystem,
    },
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      timezone: company.timezone,
      currency: company.currency,
      defaultCountryCode: company.defaultCountryCode ?? "IN",
      allowSalesPriceOverride: company.allowSalesPriceOverride ?? true,
      customerDirectoryVisibility: company.customerDirectoryVisibility ?? "DATA_SCOPE",
      createEnquiryHistoryEnabled: company.createEnquiryHistoryEnabled ?? true,
      historyPreviewFields: company.historyPreviewFields as Record<string, boolean> | null,
    },
    role: {
      id: user.role.id,
      name: user.role.name,
      isSystem: user.role.isSystem,
    },
    permissions,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
    hasPermission,
    getDataScope,
  };
}

/**
 * Revokes a session by its raw token (instant invalidation).
 */
export async function revokeSessionByToken(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashToken(rawToken);
  await prisma.session.deleteMany({
    where: { tokenHash },
  });
}

/**
 * Revokes all active sessions for a user (e.g., on password reset or deactivation).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Retrieves the authenticated context from the request cookie if valid, or null.
 */
export async function getAuthContext(request?: NextRequest): Promise<AuthContext | null> {
  let token: string | null = null;

  if (request) {
    token = request.cookies.get("universal_crm_session")?.value ?? null;
  } else {
    token = await getSessionToken();
  }

  if (!token) {
    return null;
  }

  return validateSessionToken(token);
}

/**
 * Enforces authentication. Throws UnauthorizedError if not authenticated.
 */
export async function requireAuth(request?: NextRequest): Promise<AuthContext> {
  initRequestContext(request);
  const context = await getAuthContext(request);
  if (!context) {
    throw new UnauthorizedError("Authentication required to access this resource.");
  }
  setTraceContext({
    companyId: context.company.id,
    userId: context.user.id,
  });
  return context;
}

/**
 * Enforces a specific module + action permission on an authenticated context.
 */
export function requirePermission(
  ctx: AuthContext,
  module: string,
  action: string
): void {
  if (!ctx.hasPermission(module, action)) {
    throw new ForbiddenError(`Insufficient permissions for ${module}.${action}`);
  }
}

export { setSessionCookie, clearSessionCookie };
