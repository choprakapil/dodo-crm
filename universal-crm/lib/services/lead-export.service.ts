/**
 * Lead Export Service
 *
 * Implements data-scope-aware CSV generation, active custom fields inclusion,
 * formula injection protection, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import { LeadExportQuery, leadExportQuerySchema } from "@/lib/validations/lead-export";
import { serializeCsv, CsvColumnDefinition } from "@/lib/utils/csv";
import { ForbiddenError } from "@/lib/errors";
import { Prisma } from "@prisma/client";

export class LeadExportService {
  /**
   * Export tenant leads to CSV according to active filters and authenticated user's data scope.
   */
  static async exportLeadsCsv(ctx: AuthContext, rawQuery: LeadExportQuery) {
    if (!ctx.hasPermission("leads", "export") && !ctx.hasPermission("leads", "view")) {
      throw new ForbiddenError("You do not have permission to export leads");
    }

    const query = leadExportQuerySchema.parse(rawQuery);

    // 1. Strictly evaluate data scope (OWN, TEAM, COMPANY)
    const scopeWhere = await getLeadDataScopeWhere(ctx, "view");

    // 2. Build tenant query
    const where: Prisma.LeadWhereInput = {
      companyId: ctx.company.id, // STRICT TENANT ISOLATION
      deletedAt: null,          // EXCLUDE SOFT-DELETED
      ...scopeWhere,
    };

    if (query.statusId) where.statusId = query.statusId;
    if (query.sourceId) where.sourceId = query.sourceId;
    if (query.priority) where.priority = query.priority;
    if (query.assignedUserId) where.assignedUserId = query.assignedUserId;
    if (query.teamId) where.teamId = query.teamId;

    if (query.search && query.search.length > 0) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
        { company: { contains: query.search, mode: "insensitive" } },
      ];
    }

    // 3. Preload active custom fields for the company
    const customFields = await prisma.customField.findMany({
      where: {
        companyId: ctx.company.id,
        entityType: "LEAD",
        active: true,
        deletedAt: null,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    // 4. Fetch scoped leads with relations and custom field values
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50000, // Safe bounded upper limit
      include: {
        status: { select: { name: true } },
        source: { select: { name: true } },
        assignedUser: { select: { name: true, email: true } },
        team: { select: { name: true } },
        customFieldValues: {
          include: { customField: { select: { key: true } } },
        },
      },
    });

    // 5. Define export columns
    const columns: CsvColumnDefinition[] = [
      { key: "name", label: "Lead Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "company", label: "Company" },
      { key: "amount", label: "Deal Value" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "source", label: "Source" },
      { key: "assignedUser", label: "Assigned User" },
      { key: "team", label: "Team" },
      { key: "createdAt", label: "Created At" },
      ...customFields.map((cf) => ({
        key: `cf_${cf.key}`,
        label: cf.label,
      })),
    ];

    // 6. Map leads into export row dictionaries
    const rows: Record<string, unknown>[] = leads.map((lead) => {
      const row: Record<string, unknown> = {
        name: lead.name,
        email: lead.email ?? "",
        phone: lead.phone ?? "",
        company: lead.company ?? "",
        amount: lead.amount ? Number(lead.amount) : "",
        priority: lead.priority,
        status: lead.status?.name ?? "",
        source: lead.source?.name ?? "",
        assignedUser: lead.assignedUser?.name ?? lead.assignedUser?.email ?? "",
        team: lead.team?.name ?? "",
        createdAt: lead.createdAt.toISOString(),
      };

      // Map custom field values
      const cfMap = new Map<string, unknown>();
      for (const cfv of lead.customFieldValues) {
        cfMap.set(cfv.customField.key, cfv.value);
      }

      for (const cf of customFields) {
        const val = cfMap.get(cf.key);
        row[`cf_${cf.key}`] = val !== undefined && val !== null ? val : "";
      }

      return row;
    });

    // 7. Serialize to CSV with formula injection protection
    const csv = serializeCsv(rows, columns);

    // 8. Audit log
    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "lead_export.created",
        entityType: "lead",
        metadata: {
          count: leads.length,
          filters: query,
        },
      },
    });

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `leads_export_${timestamp}.csv`;

    return {
      csv,
      filename,
      count: leads.length,
    };
  }
}
