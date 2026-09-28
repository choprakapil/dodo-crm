/**
 * Activity Service — Slice 4
 *
 * Implements full tenant isolation, data-scope checks, lead verification,
 * audit logging, and relationship validation for CRM activities.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import {
  ActivityCreateInput,
  ActivityUpdateInput,
  ActivityListQuery,
  activityCreateSchema,
  activityUpdateSchema,
} from "@/lib/validations/activity";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import { ActivityType, Prisma } from "@prisma/client";

export class ActivityService {
  /**
   * List activities for a specific lead.
   * Enforces that the lead exists, belongs to tenant, is not soft-deleted,
   * and satisfies the user's data scope for leads.
   */
  static async listActivitiesForLead(
    ctx: AuthContext,
    leadId: string,
    query: ActivityListQuery
  ) {
    if (!ctx.hasPermission("activities", "view") && !ctx.hasPermission("leads", "view")) {
      throw new ForbiddenError("Insufficient permissions to view activities");
    }

    // 1. Verify lead belongs to tenant and satisfies data scope
    const leadScopeWhere = await getLeadDataScopeWhere(ctx, "view");
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId: ctx.company.id,
        deletedAt: null,
        ...leadScopeWhere,
      },
      select: { id: true },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    // 2. Build tenant-scoped query for activities
    const { page, limit, type, search, sortBy, sortOrder } = query;
    const where: Prisma.ActivityWhereInput = {
      companyId: ctx.company.id,
      leadId: lead.id,
    };

    if (type) {
      where.type = type;
    }

    if (search && search.length > 0) {
      where.description = { contains: search, mode: "insensitive" };
    }

    const skip = (page - 1) * limit;

    const [total, items] = await prisma.$transaction([
      prisma.activity.count({ where }),
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    return paginatedResponse(items, total, { page, pageSize: limit });
  }

  /**
   * Get single activity by ID.
   * Ensures tenant match and verifies associated lead access if linked.
   */
  static async getActivityById(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("activities", "view") && !ctx.hasPermission("leads", "view")) {
      throw new ForbiddenError("Insufficient permissions to view activities");
    }

    const activity = await prisma.activity.findFirst({
      where: {
        id,
        companyId: ctx.company.id, // STRICT TENANT ISOLATION
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        lead: {
          select: { id: true, name: true, assignedUserId: true, teamId: true, deletedAt: true },
        },
      },
    });

    if (!activity) {
      throw new NotFoundError("Activity not found");
    }

    // If linked to lead, verify user has access to that lead under scope
    if (activity.lead) {
      if (activity.lead.deletedAt !== null) {
        throw new NotFoundError("Activity not found");
      }
      const leadScopeWhere = await getLeadDataScopeWhere(ctx, "view");
      const leadAllowed = await prisma.lead.findFirst({
        where: {
          id: activity.lead.id,
          companyId: ctx.company.id,
          deletedAt: null,
          ...leadScopeWhere,
        },
        select: { id: true },
      });
      if (!leadAllowed) {
        throw new NotFoundError("Activity not found");
      }
    }

    return activity;
  }

  /**
   * Create an activity associated with a lead.
   */
  static async createActivity(
    ctx: AuthContext,
    leadId: string,
    rawInput: ActivityCreateInput
  ) {
    if (!ctx.hasPermission("activities", "create") && !ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("Insufficient permissions to create activities");
    }

    const input = activityCreateSchema.parse(rawInput);

    // 1. Verify lead belongs to tenant and user has scope to update/interact with it
    const leadScopeWhere = await getLeadDataScopeWhere(ctx, "update");
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId: ctx.company.id,
        deletedAt: null,
        ...leadScopeWhere,
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    // 2. Construct description
    const formattedDescription = input.subject
      ? `[${input.type}] ${input.subject}: ${input.description}`
      : `[${input.type}] ${input.description}`;

    // 3. Atomically create Activity and AuditLog
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const activity = await tx.activity.create({
        data: {
          companyId: ctx.company.id, // STRICT TENANT ISOLATION
          leadId: lead.id,
          userId: ctx.user.id,
          type: input.type as ActivityType,
          description: formattedDescription,
          metadata: {
            subject: input.subject || null,
            rawDescription: input.description,
            actor: ctx.user.name,
            ...(input.metadata || {}),
          },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "ACTIVITY_CREATED",
          entityType: "Activity",
          entityId: activity.id,
          metadata: {
            leadId: lead.id,
            type: input.type,
            subject: input.subject || null,
          },
        },
      });

      return activity;
    });
  }

  /**
   * Update an existing activity (description/metadata).
   */
  static async updateActivity(
    ctx: AuthContext,
    id: string,
    rawInput: ActivityUpdateInput
  ) {
    if (!ctx.hasPermission("activities", "update") && !ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("Insufficient permissions to update activities");
    }

    const input = activityUpdateSchema.parse(rawInput);

    // 1. Verify activity exists in tenant
    const existing = await this.getActivityById(ctx, id);

    // If user has OWN scope, ensure they created the activity or own the lead
    const dataScope = ctx.getDataScope("activities", "update");
    if (dataScope === "OWN" && existing.userId !== ctx.user.id && existing.lead?.assignedUserId !== ctx.user.id) {
      throw new ForbiddenError("You can only update your own activities");
    }

    const updatedMetadata = input.metadata
      ? { ...((existing.metadata as Record<string, unknown>) || {}), ...input.metadata }
      : undefined;

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.activity.update({
        where: { id: existing.id },
        data: {
          ...(input.description ? { description: input.description } : {}),
          ...(updatedMetadata !== undefined ? { metadata: updatedMetadata as Prisma.InputJsonValue } : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "ACTIVITY_UPDATED",
          entityType: "Activity",
          entityId: updated.id,
          metadata: {
            leadId: existing.leadId,
            updatedFields: Object.keys(input),
          },
        },
      });

      return updated;
    });
  }

  /**
   * Delete an activity.
   */
  static async deleteActivity(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("activities", "delete") && !ctx.hasPermission("leads", "delete")) {
      throw new ForbiddenError("Insufficient permissions to delete activities");
    }

    const existing = await this.getActivityById(ctx, id);

    const dataScope = ctx.getDataScope("activities", "delete");
    if (dataScope === "OWN" && existing.userId !== ctx.user.id) {
      throw new ForbiddenError("You can only delete your own activities");
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.activity.delete({
        where: { id: existing.id },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "ACTIVITY_DELETED",
          entityType: "Activity",
          entityId: existing.id,
          metadata: {
            leadId: existing.leadId,
            type: existing.type,
          },
        },
      });

      return { success: true };
    });
  }
}
