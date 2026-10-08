/**
 * Platform CRM Configuration Service
 *
 * Provides Super Admin management for:
 * - Offerings (Products & Services catalog)
 * - Hierarchical Dispositions (3-tier tree with followUpMandatory, allowsClose, allowsConvert)
 * - Custom Fields definitions
 * - Roles & Permissions matrix
 */

import { prisma } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { OfferingType, CustomFieldType, DataScope, Prisma } from "@prisma/client";
import { PlatformAuditLogService } from "./platform-audit-log.service";

export class PlatformCrmConfigService {
  // ===========================================================================
  // OFFERINGS (PRODUCTS & SERVICES)
  // ===========================================================================

  static async listOfferings(params: { companyId?: string; type?: OfferingType; search?: string }) {
    const where: Prisma.OfferingWhereInput = { deletedAt: null };
    if (params.companyId) where.companyId = params.companyId;
    if (params.type) where.type = params.type;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { code: { contains: params.search } },
        { company: { name: { contains: params.search } } },
      ];
    }

    return prisma.offering.findMany({
      where,
      include: {
        company: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ companyId: "asc" }, { name: "asc" }],
      take: 100,
    });
  }

  static async createOffering(
    data: {
      companyId: string;
      name: string;
      code?: string;
      description?: string;
      type: OfferingType;
      defaultPrice: number;
      currency: string;
      allowSalesPriceOverride?: boolean;
    },
    superAdminId: string
  ) {
    const offering = await prisma.offering.create({
      data: {
        companyId: data.companyId,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        description: data.description?.trim() || null,
        type: data.type,
        defaultPrice: data.defaultPrice,
        currency: data.currency,
        allowSalesPriceOverride: data.allowSalesPriceOverride ?? true,
        isActive: true,
      },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "OFFERING_CREATED",
      entityType: "OFFERING",
      entityId: offering.id,
      metadata: { offeringName: offering.name, type: offering.type, companyId: data.companyId },
    });

    return offering;
  }

  static async deleteOffering(offeringId: string, superAdminId: string) {
    const offering = await prisma.offering.findUnique({ where: { id: offeringId } });
    if (!offering) throw new NotFoundError("Offering not found.");

    await prisma.offering.update({
      where: { id: offeringId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "OFFERING_DELETED",
      entityType: "OFFERING",
      entityId: offeringId,
      metadata: { offeringName: offering.name, companyId: offering.companyId },
    });

    return { success: true };
  }

  // ===========================================================================
  // DISPOSITIONS (3-TIER HIERARCHY & GATEKEEPING)
  // ===========================================================================

  static async listDispositions(companyId?: string) {
    const where: Prisma.DispositionWhereInput = { deletedAt: null };
    if (companyId) where.companyId = companyId;

    return prisma.disposition.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, slug: true } },
        parent: { select: { id: true, name: true } },
        children: {
          select: {
            id: true,
            name: true,
            depth: true,
            isActive: true,
            followUpMandatory: true,
            allowsClose: true,
            allowsConvert: true,
          },
        },
      },
      orderBy: [{ companyId: "asc" }, { depth: "asc" }, { sortOrder: "asc" }],
    });
  }

  static async createDisposition(
    data: {
      companyId: string;
      name: string;
      description?: string;
      color?: string;
      parentId?: string;
      followUpMandatory?: boolean;
      allowsClose?: boolean;
      allowsConvert?: boolean;
    },
    superAdminId: string
  ) {
    let depth = 0;
    if (data.parentId) {
      const parent = await prisma.disposition.findUnique({ where: { id: data.parentId } });
      if (parent) {
        depth = Math.min(2, parent.depth + 1);
      }
    }

    const disposition = await prisma.disposition.create({
      data: {
        companyId: data.companyId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        color: data.color || "#4F46E5",
        parentId: data.parentId || null,
        depth,
        followUpMandatory: data.followUpMandatory ?? false,
        allowsClose: data.allowsClose ?? true,
        allowsConvert: data.allowsConvert ?? false,
        isActive: true,
      },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "DISPOSITION_CREATED",
      entityType: "DISPOSITION",
      entityId: disposition.id,
      metadata: { name: disposition.name, depth, companyId: data.companyId },
    });

    return disposition;
  }

  static async toggleDispositionStatus(dispositionId: string, isActive: boolean, superAdminId: string) {
    const disposition = await prisma.disposition.update({
      where: { id: dispositionId },
      data: { isActive },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: isActive ? "DISPOSITION_ACTIVATED" : "DISPOSITION_DEACTIVATED",
      entityType: "DISPOSITION",
      entityId: dispositionId,
      metadata: { name: disposition.name, companyId: disposition.companyId },
    });

    return disposition;
  }

  static async getDispositionHierarchyInfo(dispositionId: string) {
    const disposition = await prisma.disposition.findUnique({
      where: { id: dispositionId },
      include: {
        company: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        children: {
          where: { deletedAt: null },
          include: {
            _count: {
              select: {
                children: { where: { deletedAt: null } },
                leads: true,
              },
            },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });

    if (!disposition) {
      throw new NotFoundError("Disposition not found");
    }

    const parentPath = disposition.path || `/${disposition.id}`;
    const totalDescendantsCount = await prisma.disposition.count({
      where: {
        companyId: disposition.companyId,
        path: { startsWith: `${parentPath}/` },
        deletedAt: null,
      },
    });

    return {
      disposition,
      children: disposition.children,
      totalDescendantsCount,
      hasActiveChildren: disposition.children.length > 0,
    };
  }

  static async reassignChildren(
    sourceParentId: string,
    targetParentId: string | null,
    superAdminId: string
  ) {
    const sourceParent = await prisma.disposition.findUnique({
      where: { id: sourceParentId },
    });

    if (!sourceParent) {
      throw new NotFoundError("Source parent disposition not found");
    }

    const directChildren = await prisma.disposition.findMany({
      where: {
        companyId: sourceParent.companyId,
        parentId: sourceParentId,
        deletedAt: null,
      },
    });

    if (directChildren.length === 0) {
      return { count: 0, reassignedChildren: [] };
    }

    let targetParent: any = null;
    if (targetParentId) {
      if (targetParentId === sourceParentId) {
        throw new ValidationError("Target parent cannot be the same as source parent");
      }

      targetParent = await prisma.disposition.findFirst({
        where: {
          id: targetParentId,
          companyId: sourceParent.companyId,
          deletedAt: null,
        },
      });

      if (!targetParent) {
        throw new ValidationError("Target parent disposition does not exist or belongs to another company");
      }

      const sourcePath = sourceParent.path || `/${sourceParent.id}`;
      const targetPath = targetParent.path || `/${targetParent.id}`;

      if (targetPath.startsWith(`${sourcePath}/`) || targetParent.id === sourceParent.id) {
        throw new ValidationError(
          "Cycle detected: Cannot reassign children under a descendant of the source disposition"
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const updatedList: any[] = [];

      for (const child of directChildren) {
        let newDepth = 0;
        let newChildPath = `/${child.id}`;

        if (targetParent) {
          const targetParentPath = targetParent.path || `/${targetParent.id}`;
          newDepth = targetParent.depth + 1;
          newChildPath = `${targetParentPath}/${child.id}`;
        }

        const oldChildPrefix = child.path || `/${child.id}`;

        const updatedChild = await tx.disposition.update({
          where: { id: child.id },
          data: {
            parentId: targetParent ? targetParent.id : null,
            depth: newDepth,
            path: newChildPath,
          },
        });
        updatedList.push(updatedChild);

        const descendants = await tx.disposition.findMany({
          where: {
            companyId: sourceParent.companyId,
            path: { startsWith: `${oldChildPrefix}/` },
            deletedAt: null,
          },
        });

        for (const desc of descendants) {
          const descPath = desc.path || `/${desc.id}`;
          const updatedDescPath = newChildPath + descPath.slice(oldChildPrefix.length);
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

      await PlatformAuditLogService.logAction({
        superAdminId,
        action: "DISPOSITION_CHILDREN_REASSIGNED",
        entityType: "DISPOSITION",
        entityId: sourceParentId,
        metadata: {
          sourceParentId,
          sourceParentName: sourceParent.name,
          targetParentId: targetParent?.id || null,
          targetParentName: targetParent?.name || "Top-Level (None)",
          childrenCount: directChildren.length,
          childrenIds: directChildren.map((c) => c.id),
          companyId: sourceParent.companyId,
        },
      });

      return { count: directChildren.length, reassignedChildren: updatedList };
    });
  }

  // ===========================================================================
  // CUSTOM FIELDS
  // ===========================================================================

  static async listCustomFields(companyId?: string) {
    const where: Prisma.CustomFieldWhereInput = { deletedAt: null };
    if (companyId) where.companyId = companyId;

    return prisma.customField.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, slug: true } },
        _count: { select: { values: true } },
      },
      orderBy: [{ companyId: "asc" }, { entityType: "asc" }, { sortOrder: "asc" }],
    });
  }

  // ===========================================================================
  // ROLES & PERMISSION MATRIX
  // ===========================================================================

  static async listRoles(companyId?: string) {
    const where: Prisma.RoleWhereInput = {};
    if (companyId) where.companyId = companyId;

    return prisma.role.findMany({
      where,
      include: {
        company: { select: { id: true, name: true, slug: true } },
        permissions: true,
        _count: { select: { users: { where: { deletedAt: null } } } },
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
  }
}
