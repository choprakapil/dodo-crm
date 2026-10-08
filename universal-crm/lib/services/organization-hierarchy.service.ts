/**
 * Organizational Hierarchy Service
 *
 * Implements enterprise hierarchy management:
 * Company -> Division -> Department -> Team -> Users
 *
 * Provides CRUD for Divisions & Departments, hierarchy tree visualization,
 * parent/child safety enforcement (blocks unsafe cascading deletions),
 * multi-tenant isolation, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import {
  DivisionQueryInput,
  CreateDivisionInput,
  UpdateDivisionInput,
  DepartmentQueryInput,
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "@/lib/validations/team";
import { Prisma } from "@prisma/client";

export class OrganizationHierarchyService {
  // =========================================================================
  // DIVISIONS
  // =========================================================================

  /**
   * List divisions for tenant with department & team counts.
   */
  static async listDivisions(ctx: AuthContext, query: DivisionQueryInput) {
    if (!ctx.hasPermission("teams", "view") && !ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "view")) {
      throw new ForbiddenError("Permission denied: teams.view required");
    }

    const { page, limit, search, isActive } = query;

    const where: Prisma.DivisionWhereInput = {
      companyId: ctx.company.id,
      deletedAt: null,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search && search.trim().length > 0) {
      where.name = { contains: search.trim() };
    }

    const [total, divisions] = await Promise.all([
      prisma.division.count({ where }),
      prisma.division.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          manager: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              departments: { where: { deletedAt: null } },
            },
          },
        },
      }),
    ]);

    const formatted = divisions.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      description: d.description,
      isActive: d.isActive,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      manager: d.manager,
      departmentCount: d._count.departments,
    }));

    return paginatedResponse(formatted, total, { page, pageSize: limit });
  }

  /**
   * Get single division details with departments.
   */
  static async getDivisionById(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("teams", "view") && !ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "view")) {
      throw new ForbiddenError("Permission denied: teams.view required");
    }

    const division = await prisma.division.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        departments: {
          where: { deletedAt: null },
          include: {
            manager: { select: { id: true, name: true, email: true } },
            _count: { select: { teams: true } },
          },
        },
      },
    });

    if (!division) {
      throw new NotFoundError("Division not found");
    }

    return division;
  }

  /**
   * Create a new division in tenant.
   */
  static async createDivision(ctx: AuthContext, data: CreateDivisionInput) {
    if (!ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    // Check duplicate name in tenant
    const existing = await prisma.division.findFirst({
      where: {
        companyId: ctx.company.id,
        name: data.name.trim(),
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ValidationError("A division with this name already exists");
    }

    if (data.managerId) {
      const user = await prisma.user.findFirst({
        where: { id: data.managerId, companyId: ctx.company.id, deletedAt: null },
      });
      if (!user) {
        throw new ValidationError("Specified division manager does not exist in this company");
      }
    }

    const division = await prisma.division.create({
      data: {
        companyId: ctx.company.id,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        description: data.description?.trim() || null,
        managerId: data.managerId || null,
        isActive: data.isActive ?? true,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "division.created",
        entityType: "division",
        entityId: division.id,
        metadata: { name: division.name, code: division.code },
      },
    });

    return division;
  }

  /**
   * Update an existing division.
   */
  static async updateDivision(ctx: AuthContext, id: string, data: UpdateDivisionInput) {
    if (!ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    const division = await prisma.division.findFirst({
      where: { id, companyId: ctx.company.id, deletedAt: null },
    });

    if (!division) {
      throw new NotFoundError("Division not found");
    }

    if (data.name && data.name.trim() !== division.name) {
      const duplicate = await prisma.division.findFirst({
        where: {
          companyId: ctx.company.id,
          name: data.name.trim(),
          id: { not: id },
          deletedAt: null,
        },
      });
      if (duplicate) {
        throw new ValidationError("Another division with this name already exists");
      }
    }

    if (data.managerId) {
      const user = await prisma.user.findFirst({
        where: { id: data.managerId, companyId: ctx.company.id, deletedAt: null },
      });
      if (!user) {
        throw new ValidationError("Specified division manager does not exist in this company");
      }
    }

    const updated = await prisma.division.update({
      where: { id },
      data: {
        name: data.name ? data.name.trim() : undefined,
        code: data.code !== undefined ? (data.code ? data.code.trim() : null) : undefined,
        description:
          data.description !== undefined
            ? data.description
              ? data.description.trim()
              : null
            : undefined,
        managerId: data.managerId !== undefined ? data.managerId : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "division.updated",
        entityType: "division",
        entityId: updated.id,
        metadata: { changes: data },
      },
    });

    return updated;
  }

  /**
   * Delete division safely with child protection.
   */
  static async deleteDivision(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    const division = await prisma.division.findFirst({
      where: { id, companyId: ctx.company.id, deletedAt: null },
      include: {
        _count: { select: { departments: { where: { deletedAt: null } } } },
      },
    });

    if (!division) {
      throw new NotFoundError("Division not found");
    }

    if (division._count.departments > 0) {
      throw new ValidationError(
        `Cannot delete division "${division.name}": It contains ${division._count.departments} department(s). Move, delete, or deactivate its departments first.`
      );
    }

    await prisma.division.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "division.deleted",
        entityType: "division",
        entityId: id,
        metadata: { name: division.name },
      },
    });

    return { success: true };
  }

  // =========================================================================
  // DEPARTMENTS
  // =========================================================================

  /**
   * List departments with team counts and division details.
   */
  static async listDepartments(ctx: AuthContext, query: DepartmentQueryInput) {
    if (!ctx.hasPermission("teams", "view") && !ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "view")) {
      throw new ForbiddenError("Permission denied: teams.view required");
    }

    const { page, limit, search, divisionId, isActive } = query;

    const where: Prisma.DepartmentWhereInput = {
      companyId: ctx.company.id,
      deletedAt: null,
    };

    if (divisionId) {
      where.divisionId = divisionId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search && search.trim().length > 0) {
      where.name = { contains: search.trim() };
    }

    const [total, departments] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
        include: {
          division: {
            select: { id: true, name: true, code: true },
          },
          manager: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { teams: true },
          },
        },
      }),
    ]);

    const formatted = departments.map((d) => ({
      id: d.id,
      divisionId: d.divisionId,
      divisionName: d.division.name,
      divisionCode: d.division.code,
      name: d.name,
      code: d.code,
      description: d.description,
      isActive: d.isActive,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      manager: d.manager,
      teamCount: d._count.teams,
    }));

    return paginatedResponse(formatted, total, { page, pageSize: limit });
  }

  /**
   * Get single department by ID.
   */
  static async getDepartmentById(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("teams", "view") && !ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "view")) {
      throw new ForbiddenError("Permission denied: teams.view required");
    }

    const department = await prisma.department.findFirst({
      where: { id, companyId: ctx.company.id, deletedAt: null },
      include: {
        division: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, name: true, email: true } },
        teams: {
          include: {
            manager: { select: { id: true, name: true, email: true } },
            _count: { select: { members: true, leads: true } },
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError("Department not found");
    }

    return department;
  }

  /**
   * Create department within a valid division.
   */
  static async createDepartment(ctx: AuthContext, data: CreateDepartmentInput) {
    if (!ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    // Verify division belongs to tenant
    const division = await prisma.division.findFirst({
      where: { id: data.divisionId, companyId: ctx.company.id, deletedAt: null },
    });

    if (!division) {
      throw new ValidationError("Specified division does not exist in this company");
    }

    // Check duplicate name in division
    const duplicate = await prisma.department.findFirst({
      where: {
        companyId: ctx.company.id,
        divisionId: data.divisionId,
        name: data.name.trim(),
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new ValidationError("A department with this name already exists in the selected division");
    }

    if (data.managerId) {
      const user = await prisma.user.findFirst({
        where: { id: data.managerId, companyId: ctx.company.id, deletedAt: null },
      });
      if (!user) {
        throw new ValidationError("Specified department manager does not exist in this company");
      }
    }

    const department = await prisma.department.create({
      data: {
        companyId: ctx.company.id,
        divisionId: data.divisionId,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        description: data.description?.trim() || null,
        managerId: data.managerId || null,
        isActive: data.isActive ?? true,
      },
      include: {
        division: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "department.created",
        entityType: "department",
        entityId: department.id,
        metadata: { name: department.name, divisionId: department.divisionId },
      },
    });

    return department;
  }

  /**
   * Update department.
   */
  static async updateDepartment(ctx: AuthContext, id: string, data: UpdateDepartmentInput) {
    if (!ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    const department = await prisma.department.findFirst({
      where: { id, companyId: ctx.company.id, deletedAt: null },
    });

    if (!department) {
      throw new NotFoundError("Department not found");
    }

    const targetDivisionId = data.divisionId ?? department.divisionId;

    if (data.divisionId && data.divisionId !== department.divisionId) {
      const targetDivision = await prisma.division.findFirst({
        where: { id: data.divisionId, companyId: ctx.company.id, deletedAt: null },
      });
      if (!targetDivision) {
        throw new ValidationError("Target division does not exist in this company");
      }
    }

    if (data.name) {
      const duplicate = await prisma.department.findFirst({
        where: {
          companyId: ctx.company.id,
          divisionId: targetDivisionId,
          name: data.name.trim(),
          id: { not: id },
          deletedAt: null,
        },
      });
      if (duplicate) {
        throw new ValidationError("A department with this name already exists in the target division");
      }
    }

    if (data.managerId) {
      const user = await prisma.user.findFirst({
        where: { id: data.managerId, companyId: ctx.company.id, deletedAt: null },
      });
      if (!user) {
        throw new ValidationError("Specified department manager does not exist in this company");
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data: {
        divisionId: data.divisionId,
        name: data.name ? data.name.trim() : undefined,
        code: data.code !== undefined ? (data.code ? data.code.trim() : null) : undefined,
        description:
          data.description !== undefined
            ? data.description
              ? data.description.trim()
              : null
            : undefined,
        managerId: data.managerId !== undefined ? data.managerId : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
      include: {
        division: { select: { id: true, name: true, code: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "department.updated",
        entityType: "department",
        entityId: updated.id,
        metadata: { changes: data },
      },
    });

    return updated;
  }

  /**
   * Delete department safely with child team protection.
   */
  static async deleteDepartment(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: teams.manage required");
    }

    const department = await prisma.department.findFirst({
      where: { id, companyId: ctx.company.id, deletedAt: null },
      include: {
        _count: { select: { teams: true } },
      },
    });

    if (!department) {
      throw new NotFoundError("Department not found");
    }

    if (department._count.teams > 0) {
      throw new ValidationError(
        `Cannot delete department "${department.name}": It contains ${department._count.teams} active team(s). Move or reassign its teams first.`
      );
    }

    await prisma.department.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "department.deleted",
        entityType: "department",
        entityId: id,
        metadata: { name: department.name },
      },
    });

    return { success: true };
  }

  // =========================================================================
  // HIERARCHY TREE
  // =========================================================================

  /**
   * Fetch complete organizational tree for tenant:
   * Company -> Divisions -> Departments -> Teams -> Members (with counts)
   */
  static async getOrganizationTree(ctx: AuthContext) {
    if (!ctx.hasPermission("teams", "view") && !ctx.hasPermission("teams", "manage") && !ctx.hasPermission("settings", "view")) {
      throw new ForbiddenError("Permission denied: teams.view required");
    }

    const [divisions, unassignedTeams] = await Promise.all([
      prisma.division.findMany({
        where: {
          companyId: ctx.company.id,
          deletedAt: null,
        },
        orderBy: { name: "asc" },
        include: {
          manager: { select: { id: true, name: true, email: true } },
          departments: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
            include: {
              manager: { select: { id: true, name: true, email: true } },
              teams: {
                orderBy: { name: "asc" },
                include: {
                  manager: { select: { id: true, name: true, email: true } },
                  members: {
                    include: {
                      user: {
                        select: { id: true, name: true, email: true, status: true },
                      },
                    },
                  },
                  _count: {
                    select: {
                      members: true,
                      leads: { where: { deletedAt: null } },
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // Unassigned teams (where departmentId is null) for 100% backward compatibility
      prisma.team.findMany({
        where: {
          companyId: ctx.company.id,
          departmentId: null,
        },
        orderBy: { name: "asc" },
        include: {
          manager: { select: { id: true, name: true, email: true } },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, status: true },
              },
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

    // Calculate aggregated statistics
    let totalDepartments = 0;
    let totalAssignedTeams = 0;
    let totalMembersInTree = 0;

    const formattedDivisions = divisions.map((div) => {
      totalDepartments += div.departments.length;

      const formattedDepts = div.departments.map((dept) => {
        totalAssignedTeams += dept.teams.length;

        const formattedTeams = dept.teams.map((t) => {
          totalMembersInTree += t.members.length;
          return {
            id: t.id,
            name: t.name,
            description: t.description,
            isActive: t.isActive,
            manager: t.manager,
            memberCount: t._count.members,
            leadCount: t._count.leads,
            members: t.members.map((m) => m.user),
          };
        });

        return {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          isActive: dept.isActive,
          manager: dept.manager,
          teams: formattedTeams,
        };
      });

      return {
        id: div.id,
        name: div.name,
        code: div.code,
        description: div.description,
        isActive: div.isActive,
        manager: div.manager,
        departments: formattedDepts,
      };
    });

    const formattedUnassignedTeams = unassignedTeams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isActive: t.isActive,
      manager: t.manager,
      memberCount: t._count.members,
      leadCount: t._count.leads,
      members: t.members.map((m) => m.user),
    }));

    return {
      company: {
        id: ctx.company.id,
        name: ctx.company.name,
        slug: ctx.company.slug,
      },
      stats: {
        divisionCount: divisions.length,
        departmentCount: totalDepartments,
        teamCount: totalAssignedTeams + unassignedTeams.length,
        assignedTeamCount: totalAssignedTeams,
        unassignedTeamCount: unassignedTeams.length,
      },
      divisions: formattedDivisions,
      unassignedTeams: formattedUnassignedTeams,
    };
  }
}
