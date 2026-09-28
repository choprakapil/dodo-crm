/**
 * Custom Field Management Service
 *
 * Provides company-scoped schema definitions and per-entity value persistence.
 * Enforces strict tenant isolation, authorization, validation, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import {
  CustomFieldCreateInput,
  CustomFieldUpdateInput,
  CustomFieldReorderInput,
  customFieldCreateSchema,
  customFieldUpdateSchema,
  customFieldReorderSchema,
  validateCustomFieldValue,
} from "@/lib/validations/custom-field";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

export class CustomFieldService {
  /**
   * List custom fields for the authenticated company.
   */
  static async listCustomFields(
    ctx: AuthContext,
    entityType = "LEAD",
    includeInactive = false
  ) {
    if (!ctx.hasPermission("custom_fields", "view") && !ctx.hasPermission("settings", "view")) {
      throw new ForbiddenError("You do not have permission to view custom fields");
    }

    const where: Prisma.CustomFieldWhereInput = {
      companyId: ctx.company.id, // STRICT TENANT ISOLATION
      entityType,
      deletedAt: null,
      ...(includeInactive ? {} : { active: true }),
    };

    return await prisma.customField.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  /**
   * Get single custom field by ID.
   */
  static async getCustomFieldById(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("custom_fields", "view") && !ctx.hasPermission("settings", "view")) {
      throw new ForbiddenError("You do not have permission to view custom fields");
    }

    const field = await prisma.customField.findFirst({
      where: {
        id,
        companyId: ctx.company.id, // STRICT TENANT ISOLATION
        deletedAt: null,
      },
    });

    if (!field) {
      throw new NotFoundError("Custom field not found");
    }

    return field;
  }

  /**
   * Create a new custom field.
   */
  static async createCustomField(ctx: AuthContext, rawInput: CustomFieldCreateInput) {
    if (!ctx.hasPermission("custom_fields", "create") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("You do not have permission to create custom fields");
    }

    const input = customFieldCreateSchema.parse(rawInput);

    // Check duplicate key within company and entityType
    const existing = await prisma.customField.findFirst({
      where: {
        companyId: ctx.company.id,
        entityType: input.entityType,
        key: input.key,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ValidationError(`A custom field with key "${input.key}" already exists for ${input.entityType}`);
    }

    const field = await prisma.customField.create({
      data: {
        companyId: ctx.company.id,
        entityType: input.entityType,
        key: input.key,
        label: input.label,
        description: input.description,
        fieldType: input.fieldType,
        required: input.required,
        active: input.active,
        sortOrder: input.sortOrder,
        options: (input.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "custom_field.create",
        entityType: "custom_field",
        entityId: field.id,
        metadata: {
          key: field.key,
          label: field.label,
          fieldType: field.fieldType,
        },
      },
    });

    return field;
  }

  /**
   * Update an existing custom field.
   */
  static async updateCustomField(
    ctx: AuthContext,
    id: string,
    rawInput: CustomFieldUpdateInput
  ) {
    if (!ctx.hasPermission("custom_fields", "update") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("You do not have permission to update custom fields");
    }

    const existing = await prisma.customField.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("Custom field not found");
    }

    const input = customFieldUpdateSchema.parse(rawInput);

    const updated = await prisma.customField.update({
      where: { id: existing.id },
      data: {
        label: input.label !== undefined ? input.label : existing.label,
        description: input.description !== undefined ? input.description : existing.description,
        required: input.required !== undefined ? input.required : existing.required,
        active: input.active !== undefined ? input.active : existing.active,
        sortOrder: input.sortOrder !== undefined ? input.sortOrder : existing.sortOrder,
        options:
          input.options !== undefined
            ? (input.options as Prisma.InputJsonValue) ?? Prisma.JsonNull
            : existing.options ?? Prisma.JsonNull,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "custom_field.update",
        entityType: "custom_field",
        entityId: updated.id,
        metadata: {
          key: updated.key,
          label: updated.label,
        },
      },
    });

    return updated;
  }

  /**
   * Soft-delete/deactivate a custom field.
   */
  static async deleteCustomField(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("custom_fields", "delete") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("You do not have permission to delete custom fields");
    }

    const existing = await prisma.customField.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("Custom field not found");
    }

    await prisma.customField.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        active: false,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "custom_field.delete",
        entityType: "custom_field",
        entityId: existing.id,
        metadata: {
          key: existing.key,
          label: existing.label,
        },
      },
    });

    return { success: true, message: "Custom field deleted successfully" };
  }

  /**
   * Reorder custom fields atomically.
   */
  static async reorderCustomFields(ctx: AuthContext, rawInput: CustomFieldReorderInput) {
    if (!ctx.hasPermission("custom_fields", "update") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("You do not have permission to reorder custom fields");
    }

    const input = customFieldReorderSchema.parse(rawInput);

    await prisma.$transaction(
      input.items.map((item) =>
        prisma.customField.updateMany({
          where: {
            id: item.id,
            companyId: ctx.company.id,
          },
          data: {
            sortOrder: item.sortOrder,
          },
        })
      )
    );

    return { success: true, message: "Custom fields reordered successfully" };
  }

  /**
   * Retrieve all custom fields and values for a lead.
   */
  static async getLeadCustomFields(ctx: AuthContext, leadId: string) {
    if (!ctx.hasPermission("leads", "view") && !ctx.hasPermission("leads", "manage")) {
      throw new ForbiddenError("Insufficient permissions to view lead custom fields");
    }

    const scopeWhere = await getLeadDataScopeWhere(ctx, "view");

    // 1. Verify lead belongs to company and user's data scope
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId: ctx.company.id,
        deletedAt: null,
        ...scopeWhere,
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    // 2. Fetch all active custom fields for LEAD
    const fields = await prisma.customField.findMany({
      where: {
        companyId: ctx.company.id,
        entityType: "LEAD",
        deletedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    // 3. Fetch existing values for this lead
    const values = await prisma.customFieldValue.findMany({
      where: {
        companyId: ctx.company.id,
        entityType: "LEAD",
        entityId: leadId,
      },
    });

    const valueMap = new Map<string, unknown>();
    for (const v of values) {
      valueMap.set(v.customFieldId, v.value);
    }

    return fields.map((f) => ({
      field: f,
      value: valueMap.get(f.id) ?? null,
    }));
  }

  /**
   * Validates and persists custom values for a lead within an existing or new transaction.
   * Enforces tenant isolation, active non-deleted lead verification, and caller Data Scope.
   */
  static async saveLeadCustomFields(
    tx: Prisma.TransactionClient,
    ctx: AuthContext,
    leadId: string,
    rawValues: Record<string, unknown>,
    options?: { skipScopeCheck?: boolean }
  ) {
    if (
      !ctx.hasPermission("leads", "update") &&
      !ctx.hasPermission("leads", "create") &&
      !ctx.hasPermission("leads", "manage")
    ) {
      throw new ForbiddenError("Insufficient permissions to update lead custom fields");
    }

    const scopeWhere = options?.skipScopeCheck
      ? {}
      : await getLeadDataScopeWhere(ctx, "update");

    // Verify lead belongs to company, is not soft-deleted, and user has scope
    const lead = await tx.lead.findFirst({
      where: {
        id: leadId,
        companyId: ctx.company.id,
        deletedAt: null,
        ...scopeWhere,
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    if (!rawValues || Object.keys(rawValues).length === 0) {
      // Still need to verify any required fields
      const requiredFields = await tx.customField.findMany({
        where: {
          companyId: ctx.company.id,
          entityType: "LEAD",
          active: true,
          required: true,
          deletedAt: null,
        },
      });

      for (const rf of requiredFields) {
        throw new ValidationError(`Field "${rf.label}" is required`);
      }
      return;
    }

    // 1. Preload active custom fields for tenant
    const activeFields = await tx.customField.findMany({
      where: {
        companyId: ctx.company.id,
        entityType: "LEAD",
        active: true,
        deletedAt: null,
      },
    });

    const fieldByKey = new Map(activeFields.map((f) => [f.key, f]));
    const fieldById = new Map(activeFields.map((f) => [f.id, f]));

    // 2. Validate all active fields (both required check and type check)
    for (const field of activeFields) {
      // Look up incoming value by key or id
      const incomingVal =
        rawValues[field.key] !== undefined
          ? rawValues[field.key]
          : rawValues[field.id];

      const validatedVal = validateCustomFieldValue(field, incomingVal);

      if (validatedVal !== null && validatedVal !== undefined) {
        await tx.customFieldValue.upsert({
          where: {
            companyId_customFieldId_entityId: {
              companyId: ctx.company.id,
              customFieldId: field.id,
              entityId: leadId,
            },
          },
          update: {
            value: (validatedVal as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          },
          create: {
            companyId: ctx.company.id,
            customFieldId: field.id,
            entityType: "LEAD",
            entityId: leadId,
            value: (validatedVal as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          },
        });
      } else {
        // If explicitly set to null/empty, clean up or set null
        await tx.customFieldValue.deleteMany({
          where: {
            companyId: ctx.company.id,
            customFieldId: field.id,
            entityId: leadId,
          },
        });
      }
    }

    // 3. Prevent injection of unknown/foreign custom field keys
    for (const key of Object.keys(rawValues)) {
      if (!fieldByKey.has(key) && !fieldById.has(key)) {
        // Ignored or rejected if malicious foreign key
        continue;
      }
    }
  }
}
