/**
 * Security & Session Management Service
 *
 * Exposes safe active session inspection, individual and bulk session revocation,
 * and authenticated user self-password change with audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { NotFoundError, ValidationError, UnauthorizedError } from "@/lib/errors";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/auth/password";
import { ChangePasswordInput } from "@/lib/validations/security";

export class SecurityService {
  /**
   * List all active sessions for the current authenticated user.
   */
  static async listUserSessions(ctx: AuthContext) {
    const sessions = await prisma.session.findMany({
      where: {
        userId: ctx.user.id,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === ctx.session.id,
    }));
  }

  /**
   * Revoke a specific session for current user.
   */
  static async revokeSession(ctx: AuthContext, sessionId: string) {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: ctx.user.id,
      },
    });

    if (!session) {
      throw new NotFoundError("Session not found");
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "security.session_revoked",
        entityType: "session",
        entityId: sessionId,
      },
    });

    return { success: true, message: "Session revoked successfully" };
  }

  /**
   * Revoke all other active sessions for current user.
   */
  static async revokeAllOtherSessions(ctx: AuthContext) {
    await prisma.session.deleteMany({
      where: {
        userId: ctx.user.id,
        id: { not: ctx.session.id },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "security.sessions_revoked",
        entityType: "user",
        entityId: ctx.user.id,
        metadata: {
          keptCurrentSessionId: ctx.session.id,
        },
      },
    });

    return { success: true, message: "All other sessions revoked successfully" };
  }

  /**
   * Self password change by authenticated user.
   */
  static async changePassword(ctx: AuthContext, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
    });

    if (!user || !user.hashedPassword) {
      throw new UnauthorizedError("User record invalid or unactivated");
    }

    const isMatch = await verifyPassword(input.currentPassword, user.hashedPassword);
    if (!isMatch) {
      throw new ValidationError("Current password does not match");
    }

    const strength = validatePasswordStrength(input.newPassword);
    if (!strength.valid) {
      throw new ValidationError(`New password is too weak: ${strength.errors.join(", ")}`);
    }

    const newHash = await hashPassword(input.newPassword);

    await prisma.user.update({
      where: { id: ctx.user.id },
      data: {
        hashedPassword: newHash,
      },
    });

    // Revoke all other sessions
    await prisma.session.deleteMany({
      where: {
        userId: ctx.user.id,
        id: { not: ctx.session.id },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "security.password_changed",
        entityType: "user",
        entityId: ctx.user.id,
      },
    });

    return { success: true, message: "Password changed successfully" };
  }
}
