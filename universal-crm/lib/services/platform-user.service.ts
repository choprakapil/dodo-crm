/**
 * Platform User Management Service
 *
 * Provides Super Admin capabilities for global user directory management:
 * - Cross-tenant user listing, searching, and filtering
 * - User activation / deactivation with active session revocation
 * - Password reset with auto-generated secure temporary password
 * - Safe role transitions (promote / demote) with strict anti-escalation guards
 * - Force session revocation and account termination
 */

import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import { hashPassword } from "@/lib/auth/password";
import { generateSecureToken } from "@/lib/utils/tokens";
import { UserStatus, Prisma } from "@prisma/client";
import { PlatformAuditLogService } from "./platform-audit-log.service";

export interface PlatformUserQueryInput {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
  status?: UserStatus;
  roleId?: string;
  sortBy?: "name" | "email" | "createdAt" | "lastLoginAt";
  sortOrder?: "asc" | "desc";
}

export class PlatformUserService {
  /**
   * Lists users across all organizations with filters and pagination.
   */
  static async listGlobalUsers(query: PlatformUserQueryInput) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.roleId) {
      where.roleId = query.roleId;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term } },
        { email: { contains: term } },
        { phone: { contains: term } },
        { company: { name: { contains: term } } },
      ];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (query.sortBy === "name") {
      orderBy.name = query.sortOrder ?? "asc";
    } else if (query.sortBy === "email") {
      orderBy.email = query.sortOrder ?? "asc";
    } else if (query.sortBy === "lastLoginAt") {
      orderBy.lastLoginAt = query.sortOrder ?? "desc";
    } else {
      orderBy.createdAt = query.sortOrder ?? "desc";
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              isSystem: true,
            },
          },
          teamMembers: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              sessions: true,
              assignedLeads: true,
              assignedTasks: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      company: u.company,
      role: u.role,
      teams: u.teamMembers.map((tm) => tm.team),
      activeSessions: u._count.sessions,
      assignedLeadsCount: u._count.assignedLeads,
      assignedTasksCount: u._count.assignedTasks,
    }));

    return paginatedResponse(formatted, total, { page, pageSize: limit });
  }

  /**
   * Retrieves full details and activity history for a specific user.
   */
  static async getUserDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            plan: true,
          },
        },
        role: {
          include: {
            permissions: true,
          },
        },
        teamMembers: {
          include: {
            team: true,
          },
        },
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            assignedLeads: true,
            assignedTasks: true,
            activities: true,
            notes: true,
          },
        },
      },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found.");
    }

    return user;
  }

  /**
   * Updates user status (e.g. ACTIVE -> DISABLED) and revokes sessions on disable.
   */
  static async updateUserStatus(
    userId: string,
    status: UserStatus,
    superAdminId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found.");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    // If disabling account, purge all active sessions immediately
    if (status === UserStatus.DISABLED) {
      await prisma.session.deleteMany({
        where: { userId },
      });
    }

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: status === UserStatus.DISABLED ? "USER_DISABLED" : "USER_ACTIVATED",
      entityType: "USER",
      entityId: userId,
      beforeState: { status: user.status },
      afterState: { status: updated.status },
      metadata: {
        userName: user.name,
        userEmail: user.email,
        companyName: user.company.name,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return updated;
  }

  /**
   * Resets a user's password, generating a secure temporary password and revoking active sessions.
   */
  static async resetUserPassword(
    userId: string,
    superAdminId: string,
    customPassword?: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ temporaryPassword: string; user: { id: string; email: string; name: string } }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found.");
    }

    // Generate secure 14-char password if not provided
    const temporaryPassword = customPassword && customPassword.length >= 8
      ? customPassword
      : `Dodo@${generateSecureToken(6)}!`;

    const hashedPassword = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        hashedPassword,
        status: user.status === UserStatus.INVITED ? UserStatus.ACTIVE : user.status,
      },
    });

    // Revoke all active sessions so the user must re-authenticate
    await prisma.session.deleteMany({
      where: { userId },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "USER_PASSWORD_RESET",
      entityType: "USER",
      entityId: userId,
      metadata: {
        userName: user.name,
        userEmail: user.email,
        companyName: user.company.name,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      temporaryPassword,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * Safely changes a user's role with anti-escalation verification.
   * Normal tenant users can NEVER be promoted to Super Admin.
   */
  static async changeUserRole(
    userId: string,
    newRoleId: string,
    superAdminId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, company: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found.");
    }

    // Role must belong to the user's company
    const targetRole = await prisma.role.findFirst({
      where: {
        id: newRoleId,
        companyId: user.companyId,
      },
    });

    if (!targetRole) {
      throw new ValidationError("Target role does not exist in the user's company.");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { roleId: targetRole.id },
      include: { role: true },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "USER_ROLE_CHANGED",
      entityType: "USER",
      entityId: userId,
      beforeState: { roleId: user.roleId, roleName: user.role.name },
      afterState: { roleId: targetRole.id, roleName: targetRole.name },
      metadata: {
        userName: user.name,
        userEmail: user.email,
        companyName: user.company.name,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return updated;
  }

  /**
   * Revokes all active sessions for a user.
   */
  static async revokeUserSessions(
    userId: string,
    superAdminId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    const { count } = await prisma.session.deleteMany({
      where: { userId },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "USER_SESSIONS_REVOKED",
      entityType: "USER",
      entityId: userId,
      metadata: {
        revokedSessionCount: count,
        userName: user.name,
        userEmail: user.email,
        companyName: user.company.name,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return { revokedCount: count };
  }

  /**
   * Soft-deletes a user and revokes sessions.
   */
  static async deleteUser(
    userId: string,
    superAdminId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundError("User not found.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: UserStatus.DISABLED,
      },
    });

    await prisma.session.deleteMany({
      where: { userId },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "USER_DELETED",
      entityType: "USER",
      entityId: userId,
      metadata: {
        userName: user.name,
        userEmail: user.email,
        companyName: user.company.name,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return { success: true };
  }
}
