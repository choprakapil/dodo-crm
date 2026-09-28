/**
 * User Management Service
 *
 * Enforces strict multi-tenancy, authorization, safe field allowlisting,
 * session revocation upon deactivation, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext, revokeAllUserSessions } from "@/lib/auth/session";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { UserQueryInput, UpdateUserInput, AdminResetPasswordInput } from "@/lib/validations/user";
import { Prisma, UserStatus } from "@prisma/client";

export class UserService {
  /**
   * List users for tenant with search, filtering, and pagination.
   */
  static async listUsers(ctx: AuthContext, query: UserQueryInput) {
    if (!ctx.hasPermission("users", "view") && !ctx.hasPermission("users", "manage")) {
      throw new ForbiddenError("Permission denied: users.view required");
    }

    const { page, limit, search, status, roleId, teamId } = query;

    const where: Prisma.UserWhereInput = {
      companyId: ctx.company.id,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    if (teamId) {
      where.teamMembers = {
        some: {
          teamId,
        },
      };
    }

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          companyId: true,
          email: true,
          name: true,
          phone: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          role: {
            select: {
              id: true,
              name: true,
              isSystem: true,
            },
          },
          teamMembers: {
            select: {
              id: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                },
              },
            },
          },
          _count: {
            select: {
              assignedLeads: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      role: u.role,
      teams: u.teamMembers.map((tm) => tm.team),
      assignedLeadsCount: u._count.assignedLeads,
    }));

    return paginatedResponse(formattedUsers, total, { page, pageSize: limit });
  }

  /**
   * Get single user detail by ID.
   */
  static async getUserById(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("users", "view") && !ctx.hasPermission("users", "manage")) {
      throw new ForbiddenError("Permission denied: users.view required");
    }

    const user = await prisma.user.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
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
        managedTeams: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            assignedLeads: { where: { deletedAt: null } },
            assignedTasks: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Fetch recent activities logged by this user
    const recentActivities = await prisma.activity.findMany({
      where: {
        companyId: ctx.company.id,
        userId: id,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        description: true,
        metadata: true,
        createdAt: true,
        lead: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      ...user,
      teams: user.teamMembers.map((tm) => tm.team),
      recentActivities,
    };
  }

  /**
   * Update user details (name, phone, role, teams, status).
   */
  static async updateUser(ctx: AuthContext, id: string, data: UpdateUserInput) {
    if (!ctx.hasPermission("users", "manage")) {
      throw new ForbiddenError("Permission denied: users.manage required");
    }

    const existing = await prisma.user.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("User not found");
    }

    // If roleId changed, verify role belongs to company
    if (data.roleId && data.roleId !== existing.roleId) {
      const role = await prisma.role.findFirst({
        where: {
          id: data.roleId,
          companyId: ctx.company.id,
        },
      });

      if (!role) {
        throw new ValidationError("Invalid role specified for this company");
      }
    }

    // If teamIds provided, verify each team belongs to company
    if (data.teamIds) {
      const teams = await prisma.team.findMany({
        where: {
          id: { in: data.teamIds },
          companyId: ctx.company.id,
        },
      });

      if (teams.length !== data.teamIds.length) {
        throw new ValidationError("One or more specified teams do not belong to this company");
      }
    }

    // Check self-disable guard
    if (data.status === UserStatus.DISABLED && id === ctx.user.id) {
      throw new ValidationError("You cannot disable your own account");
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Update basic fields
      const user = await tx.user.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.roleId ? { roleId: data.roleId } : {}),
          ...(data.status ? { status: data.status } : {}),
        },
        include: {
          role: true,
        },
      });

      // 2. Update team memberships if specified
      if (data.teamIds !== undefined) {
        await tx.teamMember.deleteMany({
          where: { userId: id, companyId: ctx.company.id },
        });

        if (data.teamIds.length > 0) {
          await tx.teamMember.createMany({
            data: data.teamIds.map((teamId) => ({
              companyId: ctx.company.id,
              teamId,
              userId: id,
            })),
          });
        }
      }

      // 3. Log audit event
      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "user.updated",
          entityType: "user",
          entityId: id,
          metadata: {
            updatedFields: Object.keys(data),
            previousRole: existing.roleId,
            newRole: data.roleId ?? existing.roleId,
            status: data.status ?? existing.status,
          },
        },
      });

      return user;
    });

    // If status changed to DISABLED, revoke all active sessions immediately
    if (data.status === UserStatus.DISABLED) {
      await revokeAllUserSessions(id);
    }

    return updatedUser;
  }

  /**
   * Set user status (ACTIVE | DISABLED).
   */
  static async setUserStatus(ctx: AuthContext, id: string, status: UserStatus) {
    if (!ctx.hasPermission("users", "manage")) {
      throw new ForbiddenError("Permission denied: users.manage required");
    }

    if (id === ctx.user.id && status === UserStatus.DISABLED) {
      throw new ValidationError("You cannot disable your own account");
    }

    const existing = await prisma.user.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("User not found");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
    });

    if (status === UserStatus.DISABLED) {
      await revokeAllUserSessions(id);
    }

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: status === UserStatus.ACTIVE ? "user.enabled" : "user.disabled",
        entityType: "user",
        entityId: id,
        metadata: {
          previousStatus: existing.status,
          newStatus: status,
        },
      },
    });

    return updated;
  }

  /**
   * Soft-delete a user.
   */
  static async deleteUser(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("users", "delete") && !ctx.hasPermission("users", "manage")) {
      throw new ForbiddenError("Permission denied: users.manage required");
    }

    if (id === ctx.user.id) {
      throw new ValidationError("You cannot delete your own account");
    }

    const existing = await prisma.user.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("User not found");
    }

    const deleted = await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: UserStatus.DISABLED,
      },
    });

    // Invalidate any active sessions
    await revokeAllUserSessions(id);

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "user.deleted",
        entityType: "user",
        entityId: id,
        metadata: {
          email: existing.email,
          name: existing.name,
        },
      },
    });

    return deleted;
  }

  /**
   * Reset user password by an administrator.
   */
  static async resetUserPassword(ctx: AuthContext, id: string, input: AdminResetPasswordInput) {
    if (!ctx.hasPermission("users", "manage")) {
      throw new ForbiddenError("Permission denied: users.manage required");
    }

    const existing = await prisma.user.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("User not found");
    }

    const strength = validatePasswordStrength(input.password);
    if (!strength.valid) {
      throw new ValidationError(`Password is too weak: ${strength.errors.join(", ")}`);
    }

    const hashedPassword = await hashPassword(input.password);

    await prisma.user.update({
      where: { id },
      data: {
        hashedPassword,
        status: UserStatus.ACTIVE,
      },
    });

    // Revoke all active sessions so user must log in with new credentials
    await revokeAllUserSessions(id);

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "security.password_changed",
        entityType: "user",
        entityId: id,
        metadata: {
          resetByAdmin: true,
          actorId: ctx.user.id,
        },
      },
    });

    return { success: true, message: "User password reset successfully" };
  }
}
