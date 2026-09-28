/**
 * Team Management Service
 *
 * Implements team creation, management, membership assignment,
 * multi-tenancy isolation, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import { TeamQueryInput, CreateTeamInput, UpdateTeamInput } from "@/lib/validations/team";
import { Prisma } from "@prisma/client";

export class TeamService {
  /**
   * List teams for tenant with pagination, search, and member counts.
   */
  static async listTeams(ctx: AuthContext, query: TeamQueryInput) {
    if (!ctx.hasPermission("teams", "view") && !ctx.hasPermission("teams", "manage")) {
      throw new ForbiddenError("Permission denied: teams.view required");
    }

    const { page, limit, search, isActive } = query;

    const where: Prisma.TeamWhereInput = {
      companyId: ctx.company.id,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search && search.trim().length > 0) {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }

    const [total, teams] = await Promise.all([
      prisma.team.count({ where }),
      prisma.team.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              members: true,
              leads: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    const formattedTeams = teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      manager: t.manager,
      memberCount: t._count.members,
      leadCount: t._count.leads,
    }));

    return paginatedResponse(formattedTeams, total, { page, pageSize: limit });
  }

  /**
   * Get team details by ID including member roster.
   */
  static async getTeamById(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("teams", "view") && !ctx.hasPermission("teams", "manage")) {
      throw new ForbiddenError("Permission denied: teams.view required");
    }

    const team = await prisma.team.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                role: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            leads: { where: { deletedAt: null } },
            tasks: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundError("Team not found");
    }

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      isActive: team.isActive,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      manager: team.manager,
      members: team.members.map((m) => m.user),
      leadCount: team._count.leads,
      taskCount: team._count.tasks,
    };
  }

  /**
   * Create a new team in tenant.
   */
  static async createTeam(ctx: AuthContext, data: CreateTeamInput) {
    if (!ctx.hasPermission("teams", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    // Check duplicate name in tenant
    const existing = await prisma.team.findUnique({
      where: {
        companyId_name: {
          companyId: ctx.company.id,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new ValidationError("A team with this name already exists");
    }

    // If managerId specified, verify user belongs to tenant
    if (data.managerId) {
      const user = await prisma.user.findFirst({
        where: {
          id: data.managerId,
          companyId: ctx.company.id,
          deletedAt: null,
        },
      });

      if (!user) {
        throw new ValidationError("Specified manager does not exist in this company");
      }
    }

    const team = await prisma.team.create({
      data: {
        companyId: ctx.company.id,
        name: data.name,
        description: data.description,
        managerId: data.managerId,
        isActive: data.isActive ?? true,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // If manager specified, also automatically ensure they are a member of the team
    if (data.managerId) {
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: team.id,
            userId: data.managerId,
          },
        },
        update: {},
        create: {
          companyId: ctx.company.id,
          teamId: team.id,
          userId: data.managerId,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "team.created",
        entityType: "team",
        entityId: team.id,
        metadata: {
          name: team.name,
          managerId: team.managerId,
        },
      },
    });

    return team;
  }

  /**
   * Update an existing team.
   */
  static async updateTeam(ctx: AuthContext, id: string, data: UpdateTeamInput) {
    if (!ctx.hasPermission("teams", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    const existing = await prisma.team.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
    });

    if (!existing) {
      throw new NotFoundError("Team not found");
    }

    // If name changed, check uniqueness
    if (data.name && data.name !== existing.name) {
      const nameConflict = await prisma.team.findUnique({
        where: {
          companyId_name: {
            companyId: ctx.company.id,
            name: data.name,
          },
        },
      });

      if (nameConflict) {
        throw new ValidationError("A team with this name already exists");
      }
    }

    // If manager changed, verify user
    if (data.managerId) {
      const user = await prisma.user.findFirst({
        where: {
          id: data.managerId,
          companyId: ctx.company.id,
          deletedAt: null,
        },
      });

      if (!user) {
        throw new ValidationError("Specified manager does not exist in this company");
      }
    }

    const updated = await prisma.team.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.managerId !== undefined ? { managerId: data.managerId } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // If new manager assigned, ensure they are in team members
    if (data.managerId) {
      await prisma.teamMember.upsert({
        where: {
          teamId_userId: {
            teamId: id,
            userId: data.managerId,
          },
        },
        update: {},
        create: {
          companyId: ctx.company.id,
          teamId: id,
          userId: data.managerId,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "team.updated",
        entityType: "team",
        entityId: id,
        metadata: {
          updatedFields: Object.keys(data),
          name: updated.name,
        },
      },
    });

    return updated;
  }

  /**
   * Delete a team.
   */
  static async deleteTeam(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("teams", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    const existing = await prisma.team.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
    });

    if (!existing) {
      throw new NotFoundError("Team not found");
    }

    await prisma.$transaction(async (tx) => {
      // Remove members
      await tx.teamMember.deleteMany({
        where: { teamId: id, companyId: ctx.company.id },
      });

      // Clear team association from leads and tasks
      await tx.lead.updateMany({
        where: { teamId: id, companyId: ctx.company.id },
        data: { teamId: null },
      });

      await tx.task.updateMany({
        where: { teamId: id, companyId: ctx.company.id },
        data: { teamId: null },
      });

      // Delete team
      await tx.team.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "team.deleted",
          entityType: "team",
          entityId: id,
          metadata: {
            name: existing.name,
          },
        },
      });
    });

    return { success: true, message: "Team deleted successfully" };
  }

  /**
   * Add a member to a team.
   */
  static async addTeamMember(ctx: AuthContext, teamId: string, userId: string) {
    if (!ctx.hasPermission("teams", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    // Verify team belongs to tenant
    const team = await prisma.team.findFirst({
      where: { id: teamId, companyId: ctx.company.id },
    });

    if (!team) {
      throw new NotFoundError("Team not found");
    }

    // Verify user belongs to tenant
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId: ctx.company.id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const member = await prisma.teamMember.upsert({
      where: {
        teamId_userId: { teamId, userId },
      },
      update: {},
      create: {
        companyId: ctx.company.id,
        teamId,
        userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "team.member_added",
        entityType: "team",
        entityId: teamId,
        metadata: {
          userId,
          userName: user.name,
          teamName: team.name,
        },
      },
    });

    return member;
  }

  /**
   * Remove a member from a team.
   */
  static async removeTeamMember(ctx: AuthContext, teamId: string, userId: string) {
    if (!ctx.hasPermission("teams", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    const team = await prisma.team.findFirst({
      where: { id: teamId, companyId: ctx.company.id },
    });

    if (!team) {
      throw new NotFoundError("Team not found");
    }

    await prisma.teamMember.deleteMany({
      where: {
        teamId,
        userId,
        companyId: ctx.company.id,
      },
    });

    // If the user was the manager, clear managerId
    if (team.managerId === userId) {
      await prisma.team.update({
        where: { id: teamId },
        data: { managerId: null },
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "team.member_removed",
        entityType: "team",
        entityId: teamId,
        metadata: {
          userId,
          teamName: team.name,
        },
      },
    });

    return { success: true, message: "Member removed from team" };
  }
}
