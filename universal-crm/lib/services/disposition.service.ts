/**
 * Disposition Management Service — Phase 7
 *
 * Implements tenant-scoped, arbitrary-depth hierarchical disposition engine.
 * Supports generic operational rules, cycle detection/prevention,
 * contradictory rule enforcement, soft-deletions, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  DispositionCreateInput,
  DispositionUpdateInput,
  dispositionCreateSchema,
  dispositionUpdateSchema,
} from "@/lib/validations/disposition";
import { Disposition, Prisma } from "@prisma/client";

export interface DispositionTreeNode extends Disposition {
  children: DispositionTreeNode[];
}

export class DispositionService {
  /**
   * List flat dispositions for tenant.
   */
  static async listDispositions(
    ctx: AuthContext,
    query?: { includeInactive?: boolean; parentId?: string | null }
  ): Promise<Disposition[]> {
    const canView =
      ctx.hasPermission("dispositions", "view") ||
      ctx.hasPermission("dispositions", "manage") ||
      ctx.hasPermission("leads", "view") ||
      ctx.role.name === "Admin";

    if (!canView) {
      throw new ForbiddenError("Permission denied: dispositions.view required");
    }

    const where: Prisma.DispositionWhereInput = {
      companyId: ctx.company.id,
      deletedAt: null,
    };

    if (!query?.includeInactive) {
      where.isActive = true;
    }

    if (query?.parentId !== undefined) {
      where.parentId = query.parentId === "" || query.parentId === "null" ? null : query.parentId;
    }

    return prisma.disposition.findMany({
      where,
      orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /**
   * Get hierarchical disposition tree for tenant.
   */
  static async getDispositionTree(
    ctx: AuthContext,
    options?: { includeInactive?: boolean }
  ): Promise<DispositionTreeNode[]> {
    const canView =
      ctx.hasPermission("dispositions", "view") ||
      ctx.hasPermission("dispositions", "manage") ||
      ctx.hasPermission("leads", "view") ||
      ctx.role.name === "Admin";

    if (!canView) {
      throw new ForbiddenError("Permission denied: dispositions.view required");
    }

    const where: Prisma.DispositionWhereInput = {
      companyId: ctx.company.id,
      deletedAt: null,
    };

    if (!options?.includeInactive) {
      where.isActive = true;
    }

    const all = await prisma.disposition.findMany({
      where,
      orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    const nodeMap = new Map<string, DispositionTreeNode>();
    all.forEach((item) => {
      nodeMap.set(item.id, { ...item, children: [] });
    });

    const rootNodes: DispositionTreeNode[] = [];

    for (const item of all) {
      const node = nodeMap.get(item.id)!;
      if (item.parentId && nodeMap.has(item.parentId)) {
        nodeMap.get(item.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * Get single disposition by ID within tenant.
   */
  static async getDispositionById(
    ctx: AuthContext,
    id: string
  ): Promise<Disposition> {
    const canView =
      ctx.hasPermission("dispositions", "view") ||
      ctx.hasPermission("dispositions", "manage") ||
      ctx.hasPermission("leads", "view") ||
      ctx.role.name === "Admin";

    if (!canView) {
      throw new ForbiddenError("Permission denied: dispositions.view required");
    }

    const disposition = await prisma.disposition.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!disposition) {
      throw new NotFoundError("Disposition not found");
    }

    return disposition;
  }

  /**
   * Create a new disposition with arbitrary depth hierarchy and generic rules.
   */
  static async createDisposition(
    ctx: AuthContext,
    input: DispositionCreateInput
  ): Promise<Disposition> {
    const canManage =
      ctx.hasPermission("dispositions", "create") ||
      ctx.hasPermission("dispositions", "manage") ||
      ctx.hasPermission("settings", "manage") ||
      ctx.role.name === "Admin";

    if (!canManage) {
      throw new ForbiddenError("Permission denied: dispositions.create required");
    }

    const parsed = dispositionCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || "Validation failed");
    }
    const validated = parsed.data;

    // Guard against contradictory rules
    if (validated.cancelActiveFollowUp && validated.followUpMandatory) {
      throw new ValidationError(
        "Contradictory disposition rules: A disposition cannot simultaneously mandate a future follow-up (followUpMandatory: true) and cancel all active follow-ups (cancelActiveFollowUp: true)."
      );
    }

    let parent: Disposition | null = null;
    let depth = 0;
    const parentId = validated.parentId && validated.parentId !== "" ? validated.parentId : null;

    if (parentId) {
      parent = await prisma.disposition.findFirst({
        where: {
          id: parentId,
          companyId: ctx.company.id,
          deletedAt: null,
        },
      });

      if (!parent) {
        throw new ValidationError("Parent disposition does not exist or belongs to another tenant");
      }

      depth = parent.depth + 1;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create initial record
      const created = await tx.disposition.create({
        data: {
          companyId: ctx.company.id,
          parentId,
          name: validated.name,
          code: validated.code || null,
          description: validated.description || null,
          color: validated.color || null,
          sortOrder: validated.sortOrder ?? 0,
          depth,
          path: "", // Temporary placeholder
          isTerminal: validated.isTerminal ?? false,
          requiresFollowUp: validated.requiresFollowUp ?? false,
          followUpMandatory: validated.followUpMandatory ?? false,
          allowsClose: validated.allowsClose ?? true,
          allowsConvert: validated.allowsConvert ?? false,
          cancelActiveFollowUp: validated.cancelActiveFollowUp ?? false,
          isActive: true,
        },
      });

      // Materialize exact path
      const materializedPath = parent ? `${parent.path}/${created.id}` : `/${created.id}`;

      const updated = await tx.disposition.update({
        where: { id: created.id },
        data: { path: materializedPath },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "disposition.create",
          entityType: "Disposition",
          entityId: updated.id,
          metadata: {
            name: updated.name,
            parentId: updated.parentId,
            depth: updated.depth,
            path: updated.path,
            followUpMandatory: updated.followUpMandatory,
            cancelActiveFollowUp: updated.cancelActiveFollowUp,
          },
        },
      });

      return updated;
    });

    return result;
  }

  /**
   * Update an existing disposition.
   * Enforces cycle detection, tenant isolation, and tree path synchronization.
   */
  static async updateDisposition(
    ctx: AuthContext,
    id: string,
    input: DispositionUpdateInput
  ): Promise<Disposition> {
    const canManage =
      ctx.hasPermission("dispositions", "update") ||
      ctx.hasPermission("dispositions", "manage") ||
      ctx.hasPermission("settings", "manage") ||
      ctx.role.name === "Admin";

    if (!canManage) {
      throw new ForbiddenError("Permission denied: dispositions.update required");
    }

    const existing = await prisma.disposition.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("Disposition not found");
    }

    const parsed = dispositionUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || "Validation failed");
    }
    const validated = parsed.data;

    // Contradictory rules verification against effective state
    const effectiveCancel =
      validated.cancelActiveFollowUp !== undefined
        ? validated.cancelActiveFollowUp
        : existing.cancelActiveFollowUp;
    const effectiveMandatory =
      validated.followUpMandatory !== undefined
        ? validated.followUpMandatory
        : existing.followUpMandatory;

    if (effectiveCancel && effectiveMandatory) {
      throw new ValidationError(
        "Contradictory disposition rules: A disposition cannot simultaneously mandate a future follow-up (followUpMandatory: true) and cancel all active follow-ups (cancelActiveFollowUp: true)."
      );
    }

    // Determine parent change & hierarchy recalculation
    let parentChanged = false;
    let targetParentId: string | null = existing.parentId;

    if (validated.parentId !== undefined) {
      const normalizedParentId =
        validated.parentId === "" || validated.parentId === null ? null : validated.parentId;

      if (normalizedParentId !== existing.parentId) {
        parentChanged = true;
        targetParentId = normalizedParentId;

        // Self-parent check
        if (targetParentId === id) {
          throw new ValidationError("Cannot set disposition parent to itself");
        }

        if (targetParentId !== null) {
          const targetParent = await prisma.disposition.findFirst({
            where: {
              id: targetParentId,
              companyId: ctx.company.id,
              deletedAt: null,
            },
          });

          if (!targetParent) {
            throw new ValidationError("Target parent disposition does not exist or belongs to another tenant");
          }

          const targetParentPath = targetParent.path || `/${targetParent.id}`;
          const existingPath = existing.path || `/${existing.id}`;

          // Cycle prevention: targetParent cannot be a descendant of existing
          if (
            targetParentPath.startsWith(`${existingPath}/`) ||
            targetParent.id === existing.id
          ) {
            throw new ValidationError(
              "Cycle detected: Cannot move a disposition under itself or one of its own descendants"
            );
          }
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      let newDepth = existing.depth;
      let newPath = existing.path || `/${existing.id}`;

      if (parentChanged) {
        if (targetParentId) {
          const targetParent = await tx.disposition.findUniqueOrThrow({
            where: { id: targetParentId },
          });
          const targetParentPath = targetParent.path || `/${targetParent.id}`;
          newDepth = targetParent.depth + 1;
          newPath = `${targetParentPath}/${existing.id}`;
        } else {
          newDepth = 0;
          newPath = `/${existing.id}`;
        }

        // Update all descendants' paths and depths
        const oldPrefix = existing.path || `/${existing.id}`;
        const descendants = await tx.disposition.findMany({
          where: {
            companyId: ctx.company.id,
            path: { startsWith: `${oldPrefix}/` },
            deletedAt: null,
          },
        });

        for (const desc of descendants) {
          const descPath = desc.path || `/${desc.id}`;
          const updatedDescPath = newPath + descPath.slice(oldPrefix.length);
          const updatedDescDepth = updatedDescPath.split("/").filter(Boolean).length - 1;
          await tx.disposition.update({
            where: { id: desc.id },
            data: {
              path: updatedDescPath,
              depth: updatedDescDepth,
            },
          });
        }
      }

      const updateData: Prisma.DispositionUpdateInput = {};
      if (validated.name !== undefined) updateData.name = validated.name;
      if (validated.code !== undefined) updateData.code = validated.code || null;
      if (validated.description !== undefined) updateData.description = validated.description || null;
      if (validated.color !== undefined) updateData.color = validated.color || null;
      if (validated.sortOrder !== undefined) updateData.sortOrder = validated.sortOrder;
      if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
      if (validated.isTerminal !== undefined) updateData.isTerminal = validated.isTerminal;
      if (validated.requiresFollowUp !== undefined) updateData.requiresFollowUp = validated.requiresFollowUp;
      if (validated.followUpMandatory !== undefined) updateData.followUpMandatory = validated.followUpMandatory;
      if (validated.allowsClose !== undefined) updateData.allowsClose = validated.allowsClose;
      if (validated.allowsConvert !== undefined) updateData.allowsConvert = validated.allowsConvert;
      if (validated.cancelActiveFollowUp !== undefined) {
        updateData.cancelActiveFollowUp = validated.cancelActiveFollowUp;
      }

      if (parentChanged) {
        updateData.parent = targetParentId ? { connect: { id: targetParentId } } : { disconnect: true };
        updateData.depth = newDepth;
        updateData.path = newPath;
      }

      const updated = await tx.disposition.update({
        where: { id: existing.id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "disposition.update",
          entityType: "Disposition",
          entityId: updated.id,
          metadata: {
            previous: {
              name: existing.name,
              parentId: existing.parentId,
              depth: existing.depth,
              path: existing.path,
            },
            updated: {
              name: updated.name,
              parentId: updated.parentId,
              depth: updated.depth,
              path: updated.path,
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * Soft delete a disposition.
   * Rejects deletion if active child dispositions exist.
   */
  static async deleteDisposition(ctx: AuthContext, id: string): Promise<Disposition> {
    const canManage =
      ctx.hasPermission("dispositions", "delete") ||
      ctx.hasPermission("dispositions", "manage") ||
      ctx.hasPermission("settings", "manage") ||
      ctx.role.name === "Admin";

    if (!canManage) {
      throw new ForbiddenError("Permission denied: dispositions.delete required");
    }

    const existing = await prisma.disposition.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("Disposition not found");
    }

    // Check for active children
    const activeChildren = await prisma.disposition.findFirst({
      where: {
        companyId: ctx.company.id,
        parentId: id,
        deletedAt: null,
      },
    });

    if (activeChildren) {
      throw new ValidationError(
        "Cannot delete disposition with active child dispositions. Please delete or reassign child dispositions first."
      );
    }

    const deleted = await prisma.disposition.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "disposition.delete",
        entityType: "Disposition",
        entityId: deleted.id,
        metadata: {
          name: deleted.name,
          path: deleted.path,
        },
      },
    });

    return deleted;
  }
}
