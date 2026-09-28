/**
 * Lead Import Service
 *
 * Implements streaming/chunked RFC 4180 CSV processing, column mapping,
 * preloaded reference resolution, duplicate handling (SKIP, UPDATE, CREATE),
 * custom field persistence, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { parseCsv, detectColumnMappings } from "@/lib/utils/csv";
import {
  LeadImportExecuteInput,
  leadImportPreviewSchema,
  leadImportExecuteSchema,
} from "@/lib/validations/lead-import";
import { validateCustomFieldValue } from "@/lib/validations/custom-field";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import { ActivityType, LeadPriority, Prisma } from "@prisma/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 50000;
const BATCH_SIZE = 100;

export interface ImportErrorDetail {
  row: number;
  name?: string;
  email?: string;
  reason: string;
}

export class LeadImportService {
  /**
   * Preview a CSV file: detect headers, suggest column mappings, and return sample rows.
   */
  static async previewImport(ctx: AuthContext, rawCsv: string, filename = "import.csv") {
    if (!ctx.hasPermission("leads", "create")) {
      throw new ForbiddenError("You do not have permission to import leads");
    }

    const { csvContent } = leadImportPreviewSchema.parse({
      csvContent: rawCsv,
      filename,
    });

    if (csvContent.length > MAX_FILE_SIZE) {
      throw new ValidationError("CSV file size exceeds the 10 MB limit");
    }

    const { headers, rows } = parseCsv(csvContent);

    if (headers.length === 0) {
      throw new ValidationError("No valid CSV headers detected");
    }

    if (rows.length > MAX_ROWS) {
      throw new ValidationError(`CSV row count (${rows.length}) exceeds the maximum limit of ${MAX_ROWS}`);
    }

    // Preload custom fields for the company to provide auto-mapping
    const customFields = await prisma.customField.findMany({
      where: {
        companyId: ctx.company.id,
        entityType: "LEAD",
        deletedAt: null,
      },
      select: { key: true, label: true, fieldType: true, required: true },
      orderBy: { sortOrder: "asc" },
    });

    const suggestedMappings = detectColumnMappings(headers, customFields);

    const sampleRows = rows.slice(0, 5);

    const availableFields = [
      { key: "name", label: "Lead Name", required: true, isCustom: false },
      { key: "email", label: "Email Address", required: false, isCustom: false },
      { key: "phone", label: "Phone Number", required: false, isCustom: false },
      { key: "company", label: "Company / Organization", required: false, isCustom: false },
      { key: "amount", label: "Deal Value / Amount", required: false, isCustom: false },
      { key: "priority", label: "Priority (LOW, MEDIUM, HIGH, URGENT)", required: false, isCustom: false },
      { key: "status", label: "Status Name", required: false, isCustom: false },
      { key: "source", label: "Source Name", required: false, isCustom: false },
      { key: "assignedUser", label: "Assigned User (Email or Name)", required: false, isCustom: false },
      { key: "team", label: "Team Name", required: false, isCustom: false },
      ...customFields.map((cf) => ({
        key: `cf_${cf.key}`,
        label: `Custom: ${cf.label} (${cf.fieldType})`,
        required: cf.required,
        isCustom: true,
      })),
    ];

    return {
      filename,
      totalRows: rows.length,
      detectedHeaders: headers,
      suggestedMappings,
      sampleRows,
      availableFields,
    };
  }

  /**
   * Execute batch import with duplicate detection and custom field resolution.
   */
  static async executeImport(ctx: AuthContext, rawInput: LeadImportExecuteInput) {
    if (!ctx.hasPermission("leads", "create")) {
      throw new ForbiddenError("You do not have permission to import leads");
    }

    const input = leadImportExecuteSchema.parse(rawInput);

    if (input.csvContent.length > MAX_FILE_SIZE) {
      throw new ValidationError("CSV file size exceeds the 10 MB limit");
    }

    const { headers, rows } = parseCsv(input.csvContent);

    if (headers.length === 0 || rows.length === 0) {
      throw new ValidationError("CSV contains no rows to import");
    }

    if (rows.length > MAX_ROWS) {
      throw new ValidationError(`CSV exceeds the maximum limit of ${MAX_ROWS} rows`);
    }

    if (!Object.values(input.columnMappings).includes("name")) {
      throw new ValidationError("Column mappings must include a mapping for the required 'name' field");
    }

    // 1. Create LeadImport tracking record
    const leadImport = await prisma.leadImport.create({
      data: {
        companyId: ctx.company.id,
        createdById: ctx.user.id,
        filename: input.filename,
        totalRows: rows.length,
        status: "PROCESSING",
      },
    });

    // 2. Preload tenant reference maps in memory (Eliminates N+1 queries)
    const [statuses, sources, users, teams, customFields] = await Promise.all([
      prisma.leadStatus.findMany({ where: { companyId: ctx.company.id } }),
      prisma.leadSource.findMany({ where: { companyId: ctx.company.id } }),
      prisma.user.findMany({ where: { companyId: ctx.company.id, deletedAt: null } }),
      prisma.team.findMany({ where: { companyId: ctx.company.id } }),
      prisma.customField.findMany({
        where: { companyId: ctx.company.id, entityType: "LEAD", deletedAt: null },
      }),
    ]);

    const defaultStatus = statuses.find((s) => s.isDefault) ?? statuses[0];

    const statusMap = new Map<string, string>();
    for (const s of statuses) {
      statusMap.set(s.name.toLowerCase().trim(), s.id);
      statusMap.set(s.id, s.id);
    }

    const sourceMap = new Map<string, string>();
    for (const s of sources) {
      sourceMap.set(s.name.toLowerCase().trim(), s.id);
      sourceMap.set(s.id, s.id);
    }

    const userMap = new Map<string, string>();
    for (const u of users) {
      userMap.set(u.email.toLowerCase().trim(), u.id);
      userMap.set(u.name.toLowerCase().trim(), u.id);
      userMap.set(u.id, u.id);
    }

    const teamMap = new Map<string, string>();
    for (const t of teams) {
      teamMap.set(t.name.toLowerCase().trim(), t.id);
      teamMap.set(t.id, t.id);
    }

    const customFieldByKey = new Map(customFields.map((cf) => [cf.key, cf]));
    const customFieldByPrefixedKey = new Map(customFields.map((cf) => [`cf_${cf.key}`, cf]));

    // Invert column mappings: crmFieldKey -> csvHeader
    const mappingEntries = Object.entries(input.columnMappings);
    const getFieldValue = (row: Record<string, string>, targetKey: string): string | undefined => {
      for (const [csvCol, crmKey] of mappingEntries) {
        if (crmKey === targetKey && row[csvCol] !== undefined) {
          const val = row[csvCol].trim();
          return val.length > 0 ? val : undefined;
        }
      }
      return undefined;
    };

    let successfulRows = 0;
    let skippedRows = 0;
    let updatedRows = 0;
    let failedRows = 0;
    const errorDetails: ImportErrorDetail[] = [];

    // 3. Process in batches
    for (let b = 0; b < rows.length; b += BATCH_SIZE) {
      const batch = rows.slice(b, b + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {
        for (let idx = 0; idx < batch.length; idx++) {
          const rowNumber = b + idx + 1;
          const row = batch[idx];

          try {
            const rawName = getFieldValue(row, "name");
            if (!rawName) {
              failedRows++;
              errorDetails.push({ row: rowNumber, reason: 'Missing required field: "Lead Name"' });
              continue;
            }

            const rawEmail = getFieldValue(row, "email")?.toLowerCase();
            const rawPhone = getFieldValue(row, "phone");
            const rawCompany = getFieldValue(row, "company");
            const rawAmount = getFieldValue(row, "amount");
            const rawPriority = getFieldValue(row, "priority")?.toUpperCase();
            const rawStatus = getFieldValue(row, "status");
            const rawSource = getFieldValue(row, "source");
            const rawAssignedUser = getFieldValue(row, "assignedUser");
            const rawTeam = getFieldValue(row, "team");

            // Priority resolution
            let priority: LeadPriority = LeadPriority.MEDIUM;
            if (rawPriority && Object.values(LeadPriority).includes(rawPriority as LeadPriority)) {
              priority = rawPriority as LeadPriority;
            }

            // Amount resolution
            let amount: number | null = null;
            if (rawAmount) {
              const cleaned = rawAmount.replace(/[^0-9.-]+/g, "");
              const parsed = Number(cleaned);
              if (!isNaN(parsed)) amount = parsed;
            }

            // Status resolution
            let statusId = defaultStatus?.id ?? null;
            if (rawStatus) {
              const matched = statusMap.get(rawStatus.toLowerCase().trim());
              if (matched) statusId = matched;
            }

            // Source resolution
            let sourceId: string | null = null;
            if (rawSource) {
              const matched = sourceMap.get(rawSource.toLowerCase().trim());
              if (matched) sourceId = matched;
            }

            // Assignee resolution
            let assignedUserId: string | null = null;
            if (rawAssignedUser) {
              const matched = userMap.get(rawAssignedUser.toLowerCase().trim());
              if (matched) assignedUserId = matched;
            }

            // Team resolution
            let teamId: string | null = null;
            if (rawTeam) {
              const matched = teamMap.get(rawTeam.toLowerCase().trim());
              if (matched) teamId = matched;
            }

            // Extract custom field values for row
            const customFieldValues: Record<string, unknown> = {};
            for (const [csvCol, crmKey] of mappingEntries) {
              const cf = customFieldByPrefixedKey.get(crmKey) ?? customFieldByKey.get(crmKey);
              if (cf && row[csvCol] !== undefined) {
                const cellVal = row[csvCol].trim();
                if (cellVal.length > 0) {
                  customFieldValues[cf.key] = cellVal;
                }
              }
            }

            // Check required custom fields
            for (const cf of customFields) {
              if (cf.required && cf.active) {
                const val = customFieldValues[cf.key];
                if (val === undefined || val === null || val === "") {
                  throw new ValidationError(`Required custom field "${cf.label}" is missing`);
                }
              }
            }

            // 4. Duplicate Check
            let existingLead = null;
            if (rawEmail) {
              existingLead = await tx.lead.findFirst({
                where: {
                  companyId: ctx.company.id,
                  email: rawEmail,
                  deletedAt: null,
                },
              });
            }
            if (!existingLead && rawPhone) {
              existingLead = await tx.lead.findFirst({
                where: {
                  companyId: ctx.company.id,
                  phone: rawPhone,
                  deletedAt: null,
                },
              });
            }

            if (existingLead) {
              if (input.duplicateStrategy === "SKIP") {
                skippedRows++;
                continue;
              } else if (input.duplicateStrategy === "UPDATE") {
                // Update existing lead safely
                const updateData: Prisma.LeadUpdateInput = {
                  name: rawName,
                  ...(rawCompany ? { company: rawCompany } : {}),
                  ...(rawAmount ? { amount } : {}),
                  ...(rawPriority ? { priority } : {}),
                  ...(sourceId ? { source: { connect: { id: sourceId } } } : {}),
                  ...(statusId ? { status: { connect: { id: statusId } } } : {}),
                  ...(assignedUserId ? { assignedUser: { connect: { id: assignedUserId } } } : {}),
                  ...(teamId ? { team: { connect: { id: teamId } } } : {}),
                };

                await tx.lead.update({
                  where: { id: existingLead.id },
                  data: updateData,
                });

                // Update custom fields
                for (const [key, val] of Object.entries(customFieldValues)) {
                  const cf = customFieldByKey.get(key);
                  if (cf) {
                    const validated = validateCustomFieldValue(cf, val);
                    await tx.customFieldValue.upsert({
                      where: {
                        companyId_customFieldId_entityId: {
                          companyId: ctx.company.id,
                          customFieldId: cf.id,
                          entityId: existingLead.id,
                        },
                      },
                      update: { value: (validated as Prisma.InputJsonValue) ?? Prisma.JsonNull },
                      create: {
                        companyId: ctx.company.id,
                        customFieldId: cf.id,
                        entityType: "LEAD",
                        entityId: existingLead.id,
                        value: (validated as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                      },
                    });
                  }
                }

                updatedRows++;
                continue;
              }
              // If strategy === "CREATE", fall through to create another record
            }

            // Create new lead
            const newLead = await tx.lead.create({
              data: {
                companyId: ctx.company.id, // Strictly server-side
                name: rawName,
                email: rawEmail || null,
                phone: rawPhone || null,
                company: rawCompany || null,
                amount,
                priority,
                statusId,
                sourceId,
                assignedUserId,
                teamId,
              },
            });

            // Save custom field values
            for (const [key, val] of Object.entries(customFieldValues)) {
              const cf = customFieldByKey.get(key);
              if (cf) {
                const validated = validateCustomFieldValue(cf, val);
                await tx.customFieldValue.create({
                  data: {
                    companyId: ctx.company.id,
                    customFieldId: cf.id,
                    entityType: "LEAD",
                    entityId: newLead.id,
                    value: (validated as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                  },
                });
              }
            }

            // Initial status history
            if (statusId) {
              await tx.leadStatusHistory.create({
                data: {
                  companyId: ctx.company.id,
                  leadId: newLead.id,
                  fromStatusId: null,
                  toStatusId: statusId,
                  changedById: ctx.user.id,
                },
              });
            }

            // Initial timeline activity
            await tx.activity.create({
              data: {
                companyId: ctx.company.id,
                leadId: newLead.id,
                userId: ctx.user.id,
                type: ActivityType.LEAD_CREATED,
                description: `Lead "${newLead.name}" imported from CSV`,
              },
            });

            successfulRows++;
          } catch (err: unknown) {
            failedRows++;
            const message = err instanceof Error ? err.message : "Validation or insertion error";
            errorDetails.push({
              row: rowNumber,
              reason: message,
            });
          }
        }
      });
    }

    // 5. Finalize LeadImport status
    const finalStatus =
      failedRows === 0
        ? "COMPLETED"
        : successfulRows > 0 || updatedRows > 0
        ? "COMPLETED_WITH_ERRORS"
        : "FAILED";

    const completed = await prisma.leadImport.update({
      where: { id: leadImport.id },
      data: {
        successfulRows,
        skippedRows,
        updatedRows,
        failedRows,
        status: finalStatus,
        errorSummary: (errorDetails.slice(0, 1000) as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        completedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "lead_import.completed",
        entityType: "lead_import",
        entityId: leadImport.id,
        metadata: {
          filename: input.filename,
          total: rows.length,
          successful: successfulRows,
          updated: updatedRows,
          skipped: skippedRows,
          failed: failedRows,
        },
      },
    });

    return completed;
  }

  /**
   * List past import runs for the company.
   */
  static async listImports(ctx: AuthContext, query: { page?: number; limit?: number }) {
    if (!ctx.hasPermission("leads", "create")) {
      throw new ForbiddenError("You do not have permission to view lead imports");
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.LeadImportWhereInput = {
      companyId: ctx.company.id,
    };

    const [total, items] = await prisma.$transaction([
      prisma.leadImport.count({ where }),
      prisma.leadImport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return paginatedResponse(items, total, { page, pageSize: limit });
  }

  /**
   * Get single import details by ID.
   */
  static async getImportById(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("leads", "create")) {
      throw new ForbiddenError("You do not have permission to view lead imports");
    }

    const run = await prisma.leadImport.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!run) {
      throw new NotFoundError("Lead import run not found");
    }

    return run;
  }
}
