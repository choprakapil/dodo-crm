/**
 * Offering (Product & Service) Service
 *
 * Implements tenant catalog management for products and services.
 * Enforces tenant isolation, RBAC, soft-deletions, and audit trails.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import {
  OfferingCreateInput,
  OfferingUpdateInput,
  OfferingQueryInput,
  offeringCreateSchema,
  offeringUpdateSchema,
} from "@/lib/validations/offering";
import { Prisma } from "@prisma/client";

export class OfferingService {
  /**
   * List paginated offerings for the tenant.
   */
  static async listOfferings(ctx: AuthContext, query: OfferingQueryInput) {
    const canView =
      ctx.hasPermission("offerings", "view") ||
      ctx.hasPermission("offerings", "manage") ||
      ctx.role.name === "Admin";

    if (!canView) {
      throw new ForbiddenError("Permission denied: offerings.view required");
    }

    const page = typeof query.page === "number" && query.page > 0 ? query.page : 1;
    const limit =
      typeof query.limit === "number" && query.limit > 0 && query.limit <= 100
        ? query.limit
        : 25;
    const skip = (page - 1) * limit;

    const where: Prisma.OfferingWhereInput = {
      companyId: ctx.company.id, // STRICT TENANT ISOLATION
    };

    if (!query.includeDeleted) {
      where.deletedAt = null;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.isActive !== undefined) {
      where.isActive =
        typeof query.isActive === "boolean"
          ? query.isActive
          : String(query.isActive) === "true";
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { code: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.OfferingOrderByWithRelationInput = {
      [query.sortBy || "createdAt"]: query.sortOrder || "desc",
    };

    const [offerings, total] = await Promise.all([
      prisma.offering.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.offering.count({ where }),
    ]);

    return paginatedResponse(offerings, total, { page, pageSize: limit });
  }

  /**
   * Get an offering by ID with tenant isolation.
   */
  static async getOfferingById(ctx: AuthContext, id: string) {
    const canView =
      ctx.hasPermission("offerings", "view") ||
      ctx.hasPermission("offerings", "manage") ||
      ctx.role.name === "Admin";

    if (!canView) {
      throw new ForbiddenError("Permission denied: offerings.view required");
    }

    const offering = await prisma.offering.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
    });

    if (!offering || offering.deletedAt) {
      throw new NotFoundError("Offering not found");
    }

    return offering;
  }

  /**
   * Create a new product or service offering.
   */
  static async createOffering(ctx: AuthContext, data: OfferingCreateInput) {
    const canCreate =
      ctx.hasPermission("offerings", "create") ||
      ctx.hasPermission("offerings", "manage") ||
      ctx.role.name === "Admin";

    if (!canCreate) {
      throw new ForbiddenError("Permission denied: offerings.create required");
    }

    const validated = offeringCreateSchema.parse(data);

    const resolvedCurrency = (
      validated.currency ||
      ctx.company.currency ||
      ""
    ).trim().toUpperCase();

    if (!resolvedCurrency) {
      throw new ValidationError(
        "Offering currency is required and could not be resolved from company settings."
      );
    }

    const offering = await prisma.offering.create({
      data: {
        companyId: ctx.company.id,
        name: validated.name,
        type: validated.type,
        code: validated.code || null,
        description: validated.description || null,
        defaultPrice: new Prisma.Decimal(validated.defaultPrice),
        currency: resolvedCurrency,
        isActive: validated.isActive ?? true,
        allowSalesPriceOverride: validated.allowSalesPriceOverride ?? true,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "offering.create",
        entityType: "offering",
        entityId: offering.id,
        metadata: {
          name: offering.name,
          type: offering.type,
          defaultPrice: offering.defaultPrice.toString(),
          allowSalesPriceOverride: offering.allowSalesPriceOverride,
        },
      },
    });

    return offering;
  }

  /**
   * Update an existing offering.
   */
  static async updateOffering(ctx: AuthContext, id: string, data: OfferingUpdateInput) {
    const canUpdate =
      ctx.hasPermission("offerings", "update") ||
      ctx.hasPermission("offerings", "manage") ||
      ctx.role.name === "Admin";

    if (!canUpdate) {
      throw new ForbiddenError("Permission denied: offerings.update required");
    }

    const existing = await prisma.offering.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError("Offering not found");
    }

    const validated = offeringUpdateSchema.parse(data);
    const updateData: Prisma.OfferingUpdateInput = {};

    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.type !== undefined) updateData.type = validated.type;
    if (validated.code !== undefined) updateData.code = validated.code || null;
    if (validated.description !== undefined) updateData.description = validated.description || null;
    if (validated.defaultPrice !== undefined) {
      updateData.defaultPrice = new Prisma.Decimal(validated.defaultPrice);
    }
    if (validated.currency !== undefined) updateData.currency = validated.currency;
    if (validated.isActive !== undefined) updateData.isActive = validated.isActive;
    if (validated.allowSalesPriceOverride !== undefined) {
      updateData.allowSalesPriceOverride = validated.allowSalesPriceOverride;
    }

    const updated = await prisma.offering.update({
      where: { id: existing.id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "offering.update",
        entityType: "offering",
        entityId: updated.id,
        metadata: {
          updatedFields: Object.keys(data),
          oldPrice: existing.defaultPrice.toString(),
          newPrice: updated.defaultPrice.toString(),
          oldAllowOverride: existing.allowSalesPriceOverride,
          newAllowOverride: updated.allowSalesPriceOverride,
          isActive: updated.isActive,
        },
      },
    });

    return updated;
  }

  /**
   * Soft-delete an offering. Historical leads remain intact with historical prices.
   */
  static async softDeleteOffering(ctx: AuthContext, id: string) {
    const canDelete =
      ctx.hasPermission("offerings", "delete") ||
      ctx.hasPermission("offerings", "manage") ||
      ctx.role.name === "Admin";

    if (!canDelete) {
      throw new ForbiddenError("Permission denied: offerings.delete required");
    }

    const existing = await prisma.offering.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
    });

    if (!existing || existing.deletedAt) {
      throw new NotFoundError("Offering not found");
    }

    const deleted = await prisma.offering.update({
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
        action: "offering.deleted",
        entityType: "offering",
        entityId: deleted.id,
        metadata: {
          name: deleted.name,
        },
      },
    });

    return { success: true, message: "Offering archived successfully" };
  }
}
