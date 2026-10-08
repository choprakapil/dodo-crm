import { withObservability } from "@/lib/observability";
/**
 * CRM Leads Bulk Actions API Route
 * POST /api/v1/leads/bulk — Assign, update status/priority, or delete leads with strict RBAC data-scope enforcement
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { LeadPriority, DataScope, Prisma } from "@prisma/client";
import { handleApiError, ValidationError } from "@/lib/errors";
import { validateCustomFieldValue } from "@/lib/validations/custom-field";

const bulkLeadActionSchema = z.object({
  action: z.enum([
    "ASSIGN_USER",
    "ASSIGN_TEAM",
    "CHANGE_STATUS",
    "CHANGE_PRIORITY",
    "DELETE",
    "EDIT_CUSTOM_FIELDS",
    "UPDATE_CUSTOM_FIELDS",
  ]),
  leadIds: z.array(z.string().min(1)).min(1, "At least one lead must be selected"),
  assignedUserId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  statusId: z.string().optional(),
  priority: z.nativeEnum(LeadPriority).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  clearFieldKeys: z.array(z.string()).optional(),
  customFieldUpdates: z
    .array(
      z.object({
        key: z.string().min(1),
        value: z.unknown().optional(),
        action: z.enum(["SET", "CLEAR"]).default("SET"),
      })
    )
    .optional(),
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const body = await req.json();

    const parseResult = bulkLeadActionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const {
      action,
      leadIds,
      assignedUserId,
      teamId,
      statusId,
      priority,
      customFields,
      clearFieldKeys,
      customFieldUpdates,
    } = parseResult.data;

    // Check RBAC module permission
    const requiredAction =
      action === "ASSIGN_USER" || action === "ASSIGN_TEAM"
        ? "assign"
        : action === "DELETE"
        ? "delete"
        : "update";

    if (!ctx.hasPermission("leads", requiredAction)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `You do not have permission to ${requiredAction} leads.`,
          },
        },
        { status: 403 }
      );
    }

    const dataScope = ctx.getDataScope("leads", requiredAction) || DataScope.OWN;

    // Pre-validate custom fields if action is EDIT_CUSTOM_FIELDS or UPDATE_CUSTOM_FIELDS
    interface PlannedFieldUpdate {
      field: {
        id: string;
        key: string;
        label: string;
        fieldType: any;
        required: boolean;
        options?: any;
      };
      action: "SET" | "CLEAR";
      normalizedValue?: unknown;
    }

    const plannedFieldUpdates: PlannedFieldUpdate[] = [];

    if (action === "EDIT_CUSTOM_FIELDS" || action === "UPDATE_CUSTOM_FIELDS") {
      const activeFields = await prisma.customField.findMany({
        where: {
          companyId: ctx.company.id,
          entityType: "LEAD",
          active: true,
          deletedAt: null,
        },
      });

      const findField = (identifier: string) =>
        activeFields.find((f) => f.key === identifier || f.id === identifier);

      // 1. Process customFieldUpdates array
      if (customFieldUpdates && customFieldUpdates.length > 0) {
        for (const update of customFieldUpdates) {
          const field = findField(update.key);
          if (!field) {
            throw new ValidationError(`Custom field "${update.key}" not found or not active`);
          }

          if (update.action === "CLEAR") {
            if (field.required) {
              throw new ValidationError(`Field "${field.label}" is required and cannot be cleared`);
            }
            plannedFieldUpdates.push({ field, action: "CLEAR" });
          } else {
            const normalized = validateCustomFieldValue(field, update.value);
            if (normalized === null || normalized === undefined) {
              if (field.required) {
                throw new ValidationError(`Field "${field.label}" is required`);
              }
              plannedFieldUpdates.push({ field, action: "CLEAR" });
            } else {
              plannedFieldUpdates.push({ field, action: "SET", normalizedValue: normalized });
            }
          }
        }
      }

      // 2. Process clearFieldKeys array
      if (clearFieldKeys && clearFieldKeys.length > 0) {
        for (const key of clearFieldKeys) {
          const field = findField(key);
          if (!field) {
            throw new ValidationError(`Custom field "${key}" not found or not active`);
          }
          if (field.required) {
            throw new ValidationError(`Field "${field.label}" is required and cannot be cleared`);
          }
          if (!plannedFieldUpdates.some((p) => p.field.id === field.id)) {
            plannedFieldUpdates.push({ field, action: "CLEAR" });
          }
        }
      }

      // 3. Process customFields object dictionary
      if (customFields && Object.keys(customFields).length > 0) {
        for (const [key, rawVal] of Object.entries(customFields)) {
          const field = findField(key);
          if (!field) {
            throw new ValidationError(`Custom field "${key}" not found or not active`);
          }
          if (plannedFieldUpdates.some((p) => p.field.id === field.id)) {
            continue;
          }

          if (
            rawVal === null ||
            rawVal === undefined ||
            rawVal === "" ||
            (Array.isArray(rawVal) && rawVal.length === 0)
          ) {
            if (field.required) {
              throw new ValidationError(`Field "${field.label}" is required and cannot be cleared`);
            }
            plannedFieldUpdates.push({ field, action: "CLEAR" });
          } else {
            const normalized = validateCustomFieldValue(field, rawVal);
            plannedFieldUpdates.push({ field, action: "SET", normalizedValue: normalized });
          }
        }
      }

      if (plannedFieldUpdates.length === 0) {
        throw new ValidationError("No custom field updates provided");
      }
    }

    // User's teams if scope is TEAM
    const userTeamIds =
      dataScope === DataScope.TEAM
        ? (
            await prisma.teamMember.findMany({
              where: { userId: ctx.user.id, companyId: ctx.company.id },
              select: { teamId: true },
            })
          ).map((t) => t.teamId)
        : [];

    // Fetch candidate leads with strict tenant isolation
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    const leadMap = new Map(leads.map((l) => [l.id, l]));

    const succeeded: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const leadId of leadIds) {
      const lead = leadMap.get(leadId);
      if (!lead) {
        skipped.push({ id: leadId, reason: "Lead not found in this organization or already deleted" });
        continue;
      }

      // Check DataScope row authorization (PRD §9, §17)
      if (dataScope === DataScope.OWN && lead.assignedUserId !== ctx.user.id) {
        skipped.push({ id: leadId, reason: "Outside permitted data scope (OWN)" });
        continue;
      }

      if (dataScope === DataScope.TEAM && (!lead.teamId || !userTeamIds.includes(lead.teamId))) {
        skipped.push({ id: leadId, reason: "Outside permitted team data scope (TEAM)" });
        continue;
      }

      try {
        switch (action) {
          case "ASSIGN_USER": {
            await prisma.lead.update({
              where: { id: leadId },
              data: {
                assignedUserId: assignedUserId || null,
                teamId: teamId !== undefined ? teamId : lead.teamId,
              },
            });
            succeeded.push(leadId);
            break;
          }

          case "ASSIGN_TEAM": {
            await prisma.lead.update({
              where: { id: leadId },
              data: {
                teamId: teamId || null,
              },
            });
            succeeded.push(leadId);
            break;
          }

          case "CHANGE_STATUS": {
            if (!statusId) {
              throw new Error("Target status ID is required");
            }
            await prisma.lead.update({
              where: { id: leadId },
              data: { statusId },
            });
            succeeded.push(leadId);
            break;
          }

          case "CHANGE_PRIORITY": {
            if (!priority) {
              throw new Error("Target priority level is required");
            }
            await prisma.lead.update({
              where: { id: leadId },
              data: { priority },
            });
            succeeded.push(leadId);
            break;
          }

          case "DELETE": {
            await prisma.lead.update({
              where: { id: leadId },
              data: { deletedAt: new Date() },
            });
            succeeded.push(leadId);
            break;
          }

          case "EDIT_CUSTOM_FIELDS":
          case "UPDATE_CUSTOM_FIELDS": {
            await prisma.$transaction(async (tx) => {
              for (const op of plannedFieldUpdates) {
                if (op.action === "SET") {
                  await tx.customFieldValue.upsert({
                    where: {
                      companyId_customFieldId_entityId: {
                        companyId: ctx.company.id,
                        customFieldId: op.field.id,
                        entityId: leadId,
                      },
                    },
                    update: {
                      value: (op.normalizedValue as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                    },
                    create: {
                      companyId: ctx.company.id,
                      customFieldId: op.field.id,
                      entityType: "LEAD",
                      entityId: leadId,
                      value: (op.normalizedValue as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                    },
                  });
                } else {
                  await tx.customFieldValue.deleteMany({
                    where: {
                      companyId: ctx.company.id,
                      customFieldId: op.field.id,
                      entityId: leadId,
                    },
                  });
                }
              }
            });
            succeeded.push(leadId);
            break;
          }
        }
      } catch (err: any) {
        failed.push({ id: leadId, error: err?.message || "Failed to update lead" });
      }
    }

    // Tenant Audit Log
    if (succeeded.length > 0) {
      await prisma.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: `BULK_LEAD_${action}`,
          entityType: "LEAD",
          entityId: succeeded[0],
          metadata: {
            total: leadIds.length,
            succeededCount: succeeded.length,
            skippedCount: skipped.length,
            failedCount: failed.length,
            ...(plannedFieldUpdates.length > 0
              ? {
                  fields: plannedFieldUpdates.map((p) => ({
                    key: p.field.key,
                    label: p.field.label,
                    action: p.action,
                  })),
                }
              : {}),
          },
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        action,
        total: leadIds.length,
        succeededCount: succeeded.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        succeeded,
        skipped,
        failed,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
