/**
 * Role & Permission Management Service
 *
 * Implements role creation, permission assignment, privilege escalation guards,
 * system role protections, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { CreateRoleInput, UpdateRoleInput } from "@/lib/validations/role";
import { DataScope } from "@prisma/client";

export const SYSTEM_MODULES = [
  { module: "customers", label: "Customers", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "leads", label: "Leads", actions: ["view", "create", "update", "delete", "assign", "export", "manage"] },
  { module: "offerings", label: "Products & Services", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "dispositions", label: "Dispositions", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "activities", label: "Activities", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "tasks", label: "Follow-ups & Tasks", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "reports", label: "Reports & Analytics", actions: ["view", "export", "manage"] },
  { module: "custom_fields", label: "Custom Fields", actions: ["view", "manage"] },
  { module: "users", label: "User Management", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "teams", label: "Team Management", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "roles", label: "Roles & Permissions", actions: ["view", "manage"] },
  { module: "settings", label: "Company Settings", actions: ["view", "manage"] },
  { module: "audit_logs", label: "Audit Logs", actions: ["view"] },
];

export class RoleService {
  /**
   * List all roles for tenant with member counts and permissions.
   */
  static async listRoles(ctx: AuthContext) {
    const canView =
      ctx.hasPermission("roles", "view") ||
      ctx.hasPermission("roles", "manage") ||
      ctx.hasPermission("settings", "manage");

    if (!canView) {
      throw new ForbiddenError("Permission denied: roles.view required");
    }

    const roles = await prisma.role.findMany({
      where: {
        companyId: ctx.company.id,
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        permissions: {
          select: {
            id: true,
            module: true,
            action: true,
            dataScope: true,
          },
        },
        _count: {
          select: {
            users: { where: { deletedAt: null } },
          },
        },
      },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      userCount: r._count.users,
      permissions: r.permissions,
    }));
  }

  /**
   * Get single role by ID with permissions and assigned users.
   */
  static async getRoleById(ctx: AuthContext, id: string) {
    const canView =
      ctx.hasPermission("roles", "view") ||
      ctx.hasPermission("roles", "manage") ||
      ctx.hasPermission("settings", "manage");

    if (!canView) {
      throw new ForbiddenError("Permission denied: roles.view required");
    }

    const role = await prisma.role.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
      include: {
        permissions: true,
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundError("Role not found");
    }

    return role;
  }

  /**
   * Create a custom role.
   */
  static async createRole(ctx: AuthContext, data: CreateRoleInput) {
    if (!ctx.hasPermission("roles", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: roles.manage required");
    }

    // Privilege delegation guard: creator cannot grant permissions they do not possess
    if (!ctx.role.isSystem || ctx.role.name !== "Admin") {
      for (const perm of data.permissions) {
        if (!ctx.hasPermission(perm.module, perm.action)) {
          throw new ForbiddenError(
            `Privilege escalation rejected: you cannot grant permission ${perm.module}.${perm.action} that you do not possess`
          );
        }
      }
    }

    // Check duplicate name in tenant
    const existing = await prisma.role.findUnique({
      where: {
        companyId_name: {
          companyId: ctx.company.id,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new ValidationError("A role with this name already exists");
    }

    const role = await prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          companyId: ctx.company.id,
          name: data.name,
          description: data.description,
          isSystem: false,
          permissions: {
            createMany: {
              data: data.permissions.map((p) => ({
                module: p.module,
                action: p.action,
                dataScope: p.dataScope || DataScope.COMPANY,
              })),
            },
          },
        },
        include: {
          permissions: true,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "role.created",
          entityType: "role",
          entityId: newRole.id,
          metadata: {
            name: newRole.name,
            permissionCount: data.permissions.length,
          },
        },
      });

      return newRole;
    });

    return role;
  }

  /**
   * Update a role (permissions and description).
   */
  static async updateRole(ctx: AuthContext, id: string, data: UpdateRoleInput) {
    if (!ctx.hasPermission("roles", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: roles.manage required");
    }

    const existing = await prisma.role.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
      include: {
        permissions: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Role not found");
    }

    // If system role, name cannot be changed
    if (existing.isSystem && data.name && data.name !== existing.name) {
      throw new ValidationError("System role names cannot be modified");
    }

    // Privilege delegation guard
    if (data.permissions && (!ctx.role.isSystem || ctx.role.name !== "Admin")) {
      for (const perm of data.permissions) {
        if (!ctx.hasPermission(perm.module, perm.action)) {
          throw new ForbiddenError(
            `Privilege escalation rejected: you cannot grant permission ${perm.module}.${perm.action} that you do not possess`
          );
        }
      }
    }

    // Name uniqueness check if renaming
    if (data.name && data.name !== existing.name) {
      const nameConflict = await prisma.role.findUnique({
        where: {
          companyId_name: {
            companyId: ctx.company.id,
            name: data.name,
          },
        },
      });

      if (nameConflict) {
        throw new ValidationError("A role with this name already exists");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update role properties
      const role = await tx.role.update({
        where: { id },
        data: {
          ...(data.name && !existing.isSystem ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });

      // Update permissions if provided
      if (data.permissions) {
        await tx.permission.deleteMany({
          where: { roleId: id },
        });

        await tx.permission.createMany({
          data: data.permissions.map((p) => ({
            roleId: id,
            module: p.module,
            action: p.action,
            dataScope: p.dataScope || DataScope.COMPANY,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "role.updated",
          entityType: "role",
          entityId: id,
          metadata: {
            name: role.name,
            updatedFields: Object.keys(data),
          },
        },
      });

      return tx.role.findUnique({
        where: { id },
        include: { permissions: true },
      });
    });

    return updated;
  }

  /**
   * Delete a custom role.
   */
  static async deleteRole(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("roles", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: roles.manage required");
    }

    const existing = await prisma.role.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
      include: {
        _count: {
          select: {
            users: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Role not found");
    }

    if (existing.isSystem) {
      throw new ValidationError("System roles cannot be deleted");
    }

    if (existing._count.users > 0) {
      throw new ValidationError(
        `Cannot delete role '${existing.name}' because ${existing._count.users} active user(s) are assigned to it`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.permission.deleteMany({
        where: { roleId: id },
      });

      await tx.role.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "role.deleted",
          entityType: "role",
          entityId: id,
          metadata: {
            name: existing.name,
          },
        },
      });
    });

    return { success: true, message: "Role deleted successfully" };
  }

  /**
   * Get all system permission definitions available for role assignment.
   */
  static getAvailablePermissions() {
    return SYSTEM_MODULES;
  }
}
