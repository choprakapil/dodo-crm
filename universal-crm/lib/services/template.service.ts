/**
 * Industry Template Service (Phase B.3)
 *
 * Implements tenant-scoped, configuration-driven industry template orchestration:
 * - Read-only dry run / preview (zero database mutations)
 * - Conflict detection and collision handling
 * - Atomic transactional application of blueprint configuration
 * - Strict tenant isolation (all operations bound to AuthContext)
 * - Complete idempotency (repeated applications skip existing matching entities)
 * - Security and audit logging
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { TemplateRegistry } from "@/lib/templates/registry";
import {
  IndustryTemplateDefinition,
  TemplateApplicationResult,
  TemplateApplyOptions,
  TemplateItemAnalysis,
  TemplateMetadata,
  TemplatePreviewReport,
} from "@/lib/templates/types";
import { Prisma } from "@prisma/client";

export class TemplateService {
  /**
   * Asserts administrative permissions for template preview/application.
   */
  private static assertCanManage(ctx: AuthContext) {
    const isAuthorized =
      ctx.hasPermission("settings", "manage") || ctx.role.name === "Admin";
    if (!isAuthorized) {
      throw new ForbiddenError(
        "Permission denied: Administrative access required to preview or apply industry templates."
      );
    }
  }

  /**
   * Lists available system templates (metadata only).
   */
  static listTemplates(_ctx: AuthContext): TemplateMetadata[] {
    return TemplateRegistry.listTemplates();
  }

  /**
   * Retrieves full template blueprint definition by key and optional version.
   */
  static getTemplate(key: string, version?: number): IndustryTemplateDefinition {
    const template = TemplateRegistry.getTemplate(key, version);
    if (!template) {
      throw new NotFoundError(`Industry template "${key}" not found.`);
    }
    return template;
  }

  /**
   * Generates a dry-run preview of template application for the tenant.
   * Analyzes collisions, existing items, and novel configurations.
   * GUARANTEE: Performs ZERO database mutations.
   */
  static async previewTemplate(
    ctx: AuthContext,
    key: string,
    version?: number
  ): Promise<TemplatePreviewReport> {
    this.assertCanManage(ctx);
    const template = this.getTemplate(key, version);

    // 1. Fetch current tenant-owned configuration and company state
    const [existingFields, existingDispositions, existingSources, existingStatuses, existingOfferings, currentCompany] =
      await Promise.all([
        prisma.customField.findMany({
          where: { companyId: ctx.company.id, deletedAt: null },
        }),
        prisma.disposition.findMany({
          where: { companyId: ctx.company.id, deletedAt: null },
        }),
        prisma.leadSource.findMany({
          where: { companyId: ctx.company.id },
        }),
        prisma.leadStatus.findMany({
          where: { companyId: ctx.company.id },
        }),
        prisma.offering.findMany({
          where: { companyId: ctx.company.id, deletedAt: null },
        }),
        prisma.company.findUnique({
          where: { id: ctx.company.id },
          select: { appliedTemplateKey: true, appliedTemplateVersion: true, currency: true },
        }),
      ]);

    const items: TemplateItemAnalysis[] = [];
    const conflicts: TemplatePreviewReport["conflicts"] = [];

    let fieldsToCreate = 0;
    let fieldsSkipped = 0;
    let dispositionsToCreate = 0;
    let dispositionsSkipped = 0;
    let sourcesToCreate = 0;
    let sourcesSkipped = 0;
    let statusesToCreate = 0;
    let statusesSkipped = 0;
    let offeringsToCreate = 0;
    let offeringsSkipped = 0;

    // 2. Analyze Custom Fields
    for (const cf of template.configuration.customFields) {
      const match = existingFields.find(
        (ef) => ef.key === cf.key && ef.entityType === cf.entityType
      );

      if (match) {
        if (match.fieldType === cf.fieldType) {
          fieldsSkipped++;
          items.push({
            name: cf.label,
            key: cf.key,
            type: "CUSTOM_FIELD",
            status: "SKIP_MATCH",
            reason: `Existing field matches key "${cf.key}" with identical type (${cf.fieldType})`,
            definition: cf,
          });
        } else {
          conflicts.push({
            type: "CUSTOM_FIELD",
            key: cf.key,
            existing: match.fieldType,
            template: cf.fieldType,
            message: `Custom field "${cf.key}" for ${cf.entityType} exists with incompatible type "${match.fieldType}" (template requires "${cf.fieldType}")`,
          });
          items.push({
            name: cf.label,
            key: cf.key,
            type: "CUSTOM_FIELD",
            status: "CONFLICT",
            reason: `Incompatible type mismatch: existing is "${match.fieldType}", template is "${cf.fieldType}"`,
            definition: cf,
          });
        }
      } else {
        fieldsToCreate++;
        items.push({
          name: cf.label,
          key: cf.key,
          type: "CUSTOM_FIELD",
          status: "CREATE",
          definition: cf,
        });
      }
    }

    // 3. Analyze Dispositions
    for (const disp of template.configuration.dispositions) {
      const match = existingDispositions.find(
        (ed) =>
          ed.name.trim().toLowerCase() === disp.name.trim().toLowerCase() ||
          (disp.code && ed.code?.trim().toLowerCase() === disp.code.trim().toLowerCase())
      );

      if (match) {
        dispositionsSkipped++;
        items.push({
          name: disp.name,
          key: disp.code,
          type: "DISPOSITION",
          status: "SKIP_MATCH",
          reason: `Disposition "${match.name}" already exists`,
          definition: disp,
        });
      } else {
        dispositionsToCreate++;
        items.push({
          name: disp.name,
          key: disp.code,
          type: "DISPOSITION",
          status: "CREATE",
          definition: disp,
        });
      }
    }

    // 4. Analyze Lead Sources
    for (const src of template.configuration.leadSources) {
      const match = existingSources.find(
        (es) => es.name.trim().toLowerCase() === src.name.trim().toLowerCase()
      );

      if (match) {
        sourcesSkipped++;
        items.push({
          name: src.name,
          type: "LEAD_SOURCE",
          status: "SKIP_MATCH",
          reason: `Lead source "${match.name}" already exists`,
          definition: src,
        });
      } else {
        sourcesToCreate++;
        items.push({
          name: src.name,
          type: "LEAD_SOURCE",
          status: "CREATE",
          definition: src,
        });
      }
    }

    // 5. Analyze Lead Statuses (if template provides custom statuses)
    if (template.configuration.leadStatuses) {
      for (const st of template.configuration.leadStatuses) {
        const match = existingStatuses.find(
          (es) => es.name.trim().toLowerCase() === st.name.trim().toLowerCase()
        );

        if (match) {
          statusesSkipped++;
          items.push({
            name: st.name,
            type: "LEAD_STATUS",
            status: "SKIP_MATCH",
            reason: `Lead status "${match.name}" already exists`,
            definition: st,
          });
        } else {
          statusesToCreate++;
          items.push({
            name: st.name,
            type: "LEAD_STATUS",
            status: "CREATE",
            definition: st,
          });
        }
      }
    }

    // 6. Analyze Offerings (if template provides catalog items)
    if (template.configuration.offerings) {
      for (const off of template.configuration.offerings) {
        const match = existingOfferings.find(
          (eo) =>
            eo.name.trim().toLowerCase() === off.name.trim().toLowerCase() ||
            (eo.code && off.code && eo.code.trim().toLowerCase() === off.code.trim().toLowerCase())
        );

        if (match) {
          offeringsSkipped++;
          items.push({
            name: off.name,
            key: off.code,
            type: "OFFERING",
            status: "SKIP_MATCH",
            reason: `Offering "${match.name}" (${match.code}) already exists`,
            definition: off,
          });
        } else {
          offeringsToCreate++;
          items.push({
            name: off.name,
            key: off.code,
            type: "OFFERING",
            status: "CREATE",
            definition: off,
          });
        }
      }
    }

    // 7. Check currency requirements if offerings need creation
    const companyCurrency = (currentCompany?.currency || ctx.company.currency || "").trim();
    if (offeringsToCreate > 0 && !companyCurrency) {
      conflicts.push({
        type: "OFFERING_CURRENCY",
        key: "company.currency",
        existing: "NONE",
        template: "REQUIRED",
        message: "Cannot create template offerings: Company currency is not configured. Please set company currency before applying a template with catalog offerings.",
      });
    }

    const isTemplateSwitch = Boolean(
      currentCompany?.appliedTemplateKey &&
      currentCompany.appliedTemplateKey !== template.metadata.key
    );

    return {
      template: template.metadata,
      companyId: ctx.company.id,
      canApply: conflicts.length === 0,
      summary: {
        fieldsToCreate,
        fieldsSkipped,
        dispositionsToCreate,
        dispositionsSkipped,
        sourcesToCreate,
        sourcesSkipped,
        statusesToCreate,
        statusesSkipped,
        offeringsToCreate,
        offeringsSkipped,
        conflictsCount: conflicts.length,
      },
      items,
      conflicts,
      isTemplateSwitch,
      currentTemplateKey: currentCompany?.appliedTemplateKey ?? null,
    };
  }

  /**
   * Transactionally applies the industry template to the tenant workspace.
   * - Enforces tenant authorization and boundaries
   * - Enforces ONE TEMPLATE PER COMPANY contract (requires forceSwitch for switching)
   * - Fails closed on missing company currency when creating offerings
   * - Re-verifies preview for zero conflicts
   * - Creates only missing items (idempotent, never duplicates)
   * - Writes audit log with accurate action tracking
   * - Updates company appliedTemplate metadata
   */
  static async applyTemplate(
    ctx: AuthContext,
    key: string,
    version?: number,
    options?: TemplateApplyOptions
  ): Promise<TemplateApplicationResult> {
    this.assertCanManage(ctx);
    const template = this.getTemplate(key, version);

    // 0. Verify ONE TEMPLATE PER COMPANY contract & switch semantics
    const company = await prisma.company.findUnique({
      where: { id: ctx.company.id },
      select: { appliedTemplateKey: true, appliedTemplateVersion: true, currency: true },
    });

    if (!company) {
      throw new NotFoundError("Company record not found.");
    }

    const isDifferentTemplate = Boolean(
      company.appliedTemplateKey && company.appliedTemplateKey !== template.metadata.key
    );

    if (isDifferentTemplate && !options?.forceSwitch) {
      throw new ValidationError(
        `Company already has template "${company.appliedTemplateKey}" applied. Switching to a different template ("${template.metadata.key}") requires explicit administrative confirmation (forceSwitch: true). Existing configuration will not be overwritten.`
      );
    }

    let auditAction: "template.applied" | "template.reapplied" | "template.upgraded" | "template.switched" = "template.applied";
    if (isDifferentTemplate) {
      auditAction = "template.switched";
    } else if (company.appliedTemplateKey === template.metadata.key) {
      if (
        company.appliedTemplateVersion !== null &&
        company.appliedTemplateVersion !== undefined &&
        template.metadata.version > company.appliedTemplateVersion
      ) {
        auditAction = "template.upgraded";
      } else {
        auditAction = "template.reapplied";
      }
    }

    // 1. Run preview analysis
    const preview = await this.previewTemplate(ctx, key, version);

    // 2. Guard against applying with unresolved fatal conflicts
    if (!preview.canApply || preview.conflicts.length > 0) {
      throw new ValidationError(
        `Cannot apply template "${template.metadata.name}": ${preview.conflicts.length} fatal conflict(s) detected. Existing configuration will not be overwritten.`
      );
    }

    // 3. Filter items to create
    const fieldsToCreate = preview.items
      .filter((i) => i.type === "CUSTOM_FIELD" && i.status === "CREATE")
      .map((i) => i.definition);

    const dispositionsToCreate = preview.items
      .filter((i) => i.type === "DISPOSITION" && i.status === "CREATE")
      .map((i) => i.definition);

    const sourcesToCreate = preview.items
      .filter((i) => i.type === "LEAD_SOURCE" && i.status === "CREATE")
      .map((i) => i.definition);

    const statusesToCreate = preview.items
      .filter((i) => i.type === "LEAD_STATUS" && i.status === "CREATE")
      .map((i) => i.definition);

    const offeringsToCreate = preview.items
      .filter((i) => i.type === "OFFERING" && i.status === "CREATE")
      .map((i) => i.definition);

    // Strict Currency Validation: Fail closed if offerings exist but company currency is missing
    const resolvedCompanyCurrency = (company.currency || ctx.company.currency || "").trim().toUpperCase();
    if (offeringsToCreate.length > 0 && !resolvedCompanyCurrency) {
      throw new ValidationError(
        "Cannot create offerings: Company currency is not configured. Please set company currency before applying template offerings."
      );
    }

    const appliedAt = new Date();

    // 4. Atomic transaction across all tenant-scoped creations
    await prisma.$transaction(async (tx) => {
      // Create Custom Fields
      for (const cf of fieldsToCreate) {
        await tx.customField.create({
          data: {
            companyId: ctx.company.id,
            entityType: cf.entityType,
            key: cf.key,
            label: cf.label,
            description: cf.description ?? null,
            fieldType: cf.fieldType,
            required: cf.required ?? false,
            sortOrder: cf.sortOrder ?? 0,
            active: true,
            options: (cf.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          },
        });
      }

      // Create Dispositions
      for (const disp of dispositionsToCreate) {
        await tx.disposition.create({
          data: {
            companyId: ctx.company.id,
            name: disp.name,
            code: disp.code,
            description: disp.description ?? null,
            depth: 0,
            sortOrder: disp.sortOrder ?? 0,
            isActive: true,
            requiresFollowUp: disp.followUpMandatory ?? false,
            followUpMandatory: disp.followUpMandatory ?? false,
            cancelActiveFollowUp: disp.cancelActiveFollowUp ?? false,
            allowsConvert: disp.triggersConversion ?? false,
          },
        });
      }

      // Create Lead Sources
      for (const src of sourcesToCreate) {
        await tx.leadSource.create({
          data: {
            companyId: ctx.company.id,
            name: src.name,
          },
        });
      }

      // Create Lead Statuses (if any)
      for (const st of statusesToCreate) {
        await tx.leadStatus.create({
          data: {
            companyId: ctx.company.id,
            name: st.name,
            displayOrder: st.displayOrder,
            color: st.color ?? "#6366F1",
            isDefault: st.isDefault ?? false,
          },
        });
      }

      // Create Offerings (if any) - Inherits explicit company currency with price 0 / reference
      for (const off of offeringsToCreate) {
        await tx.offering.create({
          data: {
            companyId: ctx.company.id,
            name: off.name,
            code: off.code,
            description: off.description ?? null,
            type: off.type,
            defaultPrice: off.price ?? 0,
            currency: resolvedCompanyCurrency,
            isActive: true,
          },
        });
      }

      // Update Company applied template state and default preview fields
      const updateData: Prisma.CompanyUpdateInput = {
        appliedTemplateKey: template.metadata.key,
        appliedTemplateVersion: template.metadata.version,
        appliedTemplateAt: appliedAt,
      };

      if (template.configuration.historyPreviewFields) {
        updateData.historyPreviewFields = template.configuration.historyPreviewFields;
      }

      await tx.company.update({
        where: { id: ctx.company.id },
        data: updateData,
      });

      // Audit log entry
      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: auditAction,
          entityType: "company",
          entityId: ctx.company.id,
          metadata: {
            templateKey: template.metadata.key,
            templateVersion: template.metadata.version,
            previousTemplateKey: company.appliedTemplateKey ?? null,
            previousTemplateVersion: company.appliedTemplateVersion ?? null,
            created: {
              customFields: fieldsToCreate.length,
              dispositions: dispositionsToCreate.length,
              leadSources: sourcesToCreate.length,
              leadStatuses: statusesToCreate.length,
              offerings: offeringsToCreate.length,
            },
            skipped: {
              customFields: preview.summary.fieldsSkipped,
              dispositions: preview.summary.dispositionsSkipped,
              leadSources: preview.summary.sourcesSkipped,
              leadStatuses: preview.summary.statusesSkipped,
              offerings: preview.summary.offeringsSkipped,
            },
          },
        },
      });
    });

    return {
      success: true,
      templateKey: template.metadata.key,
      templateVersion: template.metadata.version,
      appliedAt,
      action: auditAction,
      created: {
        customFields: fieldsToCreate.length,
        dispositions: dispositionsToCreate.length,
        leadSources: sourcesToCreate.length,
        leadStatuses: statusesToCreate.length,
        offerings: offeringsToCreate.length,
      },
      skipped: {
        customFields: preview.summary.fieldsSkipped,
        dispositions: preview.summary.dispositionsSkipped,
        leadSources: preview.summary.sourcesSkipped,
        leadStatuses: preview.summary.statusesSkipped,
        offerings: preview.summary.offeringsSkipped,
      },
    };
  }

  /**
   * Retrieves applied template information for the tenant company.
   */
  static async getAppliedTemplate(ctx: AuthContext) {
    const company = await prisma.company.findUnique({
      where: { id: ctx.company.id },
      select: {
        id: true,
        name: true,
        appliedTemplateKey: true,
        appliedTemplateVersion: true,
        appliedTemplateAt: true,
      },
    });

    if (!company) {
      throw new NotFoundError("Company record not found.");
    }

    let metadata: TemplateMetadata | null = null;
    if (company.appliedTemplateKey) {
      const t = TemplateRegistry.getTemplate(
        company.appliedTemplateKey,
        company.appliedTemplateVersion ?? undefined
      );
      if (t) {
        metadata = t.metadata;
      }
    }

    return {
      appliedTemplateKey: company.appliedTemplateKey,
      appliedTemplateVersion: company.appliedTemplateVersion,
      appliedTemplateAt: company.appliedTemplateAt,
      metadata,
    };
  }
}
