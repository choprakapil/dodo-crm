/**
 * Super Admin Authentication Service (Slice 8)
 *
 * Implements business logic for platform administrator login, logout,
 * password change, session management, and platform audit trail logging.
 */

import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { createSuperAdminSession, revokeSuperAdminSessionByToken } from "@/lib/auth/super-admin-session";
import { PlatformAuditLogService } from "./platform-audit-log.service";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { hashToken } from "@/lib/utils/tokens";

export interface SuperAdminLoginResult {
  superAdmin: {
    id: string;
    email: string;
    name: string;
    role: "SUPER_ADMIN";
  };
  rawToken: string;
  expiresAt: Date;
}

export class SuperAdminAuthService {
  /**
   * Authenticates a Super Admin with email and password.
   */
  static async login(
    email: string,
    passwordPlain: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<SuperAdminLoginResult> {
    const normalizedEmail = email.toLowerCase().trim();

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: normalizedEmail },
    });

    if (!superAdmin || superAdmin.deletedAt !== null) {
      // Fake password verification to mitigate timing attacks
      await verifyPassword("dummy", "$2a$12$e8kPqKkWfE4vFf.3a2qSGeY5Q9ZfD/F3o4rL1ZtA/3hWjPqjZ6z.O").catch(() => {});
      throw new UnauthorizedError("Invalid email or password.");
    }

    if (!superAdmin.isActive) {
      throw new ForbiddenError("Super Admin account has been deactivated.");
    }

    const isValid = await verifyPassword(passwordPlain, superAdmin.hashedPassword);
    if (!isValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Update lastLoginAt
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: { lastLoginAt: new Date() },
    });

    // Create SuperAdminSession
    const { rawToken, expiresAt } = await createSuperAdminSession(superAdmin.id, metadata);

    // Audit log
    await PlatformAuditLogService.logAction({
      superAdminId: superAdmin.id,
      action: "SUPER_ADMIN_LOGIN",
      entityType: "SUPER_ADMIN",
      entityId: superAdmin.id,
      metadata: { email: superAdmin.email },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: "SUPER_ADMIN",
      },
      rawToken,
      expiresAt,
    };
  }

  /**
   * Logs out a Super Admin, revoking their active session.
   */
  static async logout(
    rawToken: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    if (!rawToken) return;

    const tokenHash = hashToken(rawToken);
    const session = await prisma.superAdminSession.findUnique({
      where: { tokenHash },
    });

    if (session) {
      await PlatformAuditLogService.logAction({
        superAdminId: session.superAdminId,
        action: "SUPER_ADMIN_LOGOUT",
        entityType: "SUPER_ADMIN",
        entityId: session.superAdminId,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });

      await revokeSuperAdminSessionByToken(rawToken);
    }
  }

  /**
   * Changes the Super Admin's password and revokes all other sessions.
   */
  static async changePassword(
    superAdminId: string,
    currentPasswordPlain: string,
    newPasswordPlain: string,
    currentRawToken: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: superAdminId },
    });

    if (!superAdmin || superAdmin.deletedAt !== null) {
      throw new NotFoundError("Super Admin account not found.");
    }

    const isValid = await verifyPassword(currentPasswordPlain, superAdmin.hashedPassword);
    if (!isValid) {
      throw new UnauthorizedError("Current password is incorrect.");
    }

    const newHashedPassword = await hashPassword(newPasswordPlain);

    await prisma.superAdmin.update({
      where: { id: superAdminId },
      data: { hashedPassword: newHashedPassword },
    });

    // Revoke all other sessions except current
    const currentTokenHash = hashToken(currentRawToken);
    await prisma.superAdminSession.deleteMany({
      where: {
        superAdminId,
        tokenHash: { not: currentTokenHash },
      },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "SUPER_ADMIN_PASSWORD_CHANGED",
      entityType: "SUPER_ADMIN",
      entityId: superAdminId,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });
  }

  /**
   * Lists active sessions for a Super Admin.
   */
  static async listSessions(superAdminId: string, currentRawToken?: string) {
    const currentTokenHash = currentRawToken ? hashToken(currentRawToken) : null;

    const sessions = await prisma.superAdminSession.findMany({
      where: {
        superAdminId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return sessions.map((s) => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: currentTokenHash ? s.tokenHash === currentTokenHash : false,
    }));
  }

  /**
   * Revokes a specific session for a Super Admin.
   */
  static async revokeSession(superAdminId: string, sessionId: string): Promise<void> {
    await prisma.superAdminSession.deleteMany({
      where: {
        id: sessionId,
        superAdminId,
      },
    });
  }

  /**
   * Revokes all sessions except current for a Super Admin.
   */
  static async revokeOtherSessions(superAdminId: string, currentRawToken: string): Promise<void> {
    const currentTokenHash = hashToken(currentRawToken);
    await prisma.superAdminSession.deleteMany({
      where: {
        superAdminId,
        tokenHash: { not: currentTokenHash },
      },
    });
  }
}
