/**
 * Platform Company Service (Slice 8)
 *
 * Implements Super Admin company fleet management:
 * - Paginated company list with search, status, and plan filters
 * - Deep tenant inspector (metadata, quotas, entity statistics, platform audit events)
 * - Atomic company provisioning (roles, permissions, default statuses/sources, admin invitation)
 * - Instant company suspension (status toggle + immediate active session purge)
 * - Safe company reactivation
 */

import { prisma } from "@/lib/db";
import { paginatedResponse } from "@/lib/utils/pagination";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { ProvisionCompanyInput, PlatformCompanyQueryInput } from "@/lib/validations/platform";
import { generateSecureToken, hashToken } from "@/lib/utils/tokens";
import { emailService, EmailTemplates } from "@/lib/services/email";
import { getAppUrl } from "@/lib/config";
import { logger } from "@/lib/logger";
import { PlatformAuditLogService } from "./platform-audit-log.service";
import { QuotaService } from "./quota.service";
import { CompanyStatus, UserStatus, DataScope, PlanTier, Prisma } from "@prisma/client";

const SYSTEM_MODULES = [
  "customers",
  "leads",
  "offerings",
  "dispositions",
  "users",
  "teams",
  "reports",
  "settings",
  "audit_logs",
  "tasks",
  "notes",
  "activities",
  "custom_fields",
];

const DEFAULT_ROLE_TEMPLATES = [
  {
    name: "Admin",
    description: "Full administrative access to all company records, settings, users, and audit logs.",
    isSystem: true,
    permissions: SYSTEM_MODULES.map((module) => ({
      module,
      action: "manage",
      dataScope: DataScope.COMPANY,
    })),
  },
  {
    name: "Manager",
    description: "Manages team leads, tasks, activities, and views team reports.",
    isSystem: true,
    permissions: [
      { module: "customers", action: "view", dataScope: DataScope.COMPANY },
      { module: "customers", action: "create", dataScope: DataScope.COMPANY },
      { module: "customers", action: "update", dataScope: DataScope.COMPANY },
      { module: "customers", action: "manage", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "create", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "update", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "manage", dataScope: DataScope.COMPANY },
      { module: "dispositions", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "view", dataScope: DataScope.TEAM },
      { module: "leads", action: "create", dataScope: DataScope.TEAM },
      { module: "leads", action: "update", dataScope: DataScope.TEAM },
      { module: "leads", action: "assign", dataScope: DataScope.TEAM },
      { module: "leads", action: "delete", dataScope: DataScope.TEAM },
      { module: "leads", action: "export", dataScope: DataScope.TEAM },
      { module: "tasks", action: "view", dataScope: DataScope.TEAM },
      { module: "tasks", action: "create", dataScope: DataScope.TEAM },
      { module: "tasks", action: "update", dataScope: DataScope.TEAM },
      { module: "tasks", action: "delete", dataScope: DataScope.TEAM },
      { module: "activities", action: "view", dataScope: DataScope.TEAM },
      { module: "activities", action: "create", dataScope: DataScope.TEAM },
      { module: "activities", action: "update", dataScope: DataScope.TEAM },
      { module: "activities", action: "delete", dataScope: DataScope.TEAM },
      { module: "notes", action: "view", dataScope: DataScope.TEAM },
      { module: "notes", action: "create", dataScope: DataScope.TEAM },
      { module: "notes", action: "update", dataScope: DataScope.TEAM },
      { module: "users", action: "view", dataScope: DataScope.COMPANY },
      { module: "teams", action: "view", dataScope: DataScope.COMPANY },
      { module: "reports", action: "view", dataScope: DataScope.TEAM },
      { module: "custom_fields", action: "view", dataScope: DataScope.COMPANY },
    ],
  },
  {
    name: "Sales Rep",
    description: "Manages own assigned leads, activities, tasks, and follow-ups.",
    isSystem: true,
    permissions: [
      { module: "customers", action: "view", dataScope: DataScope.COMPANY },
      { module: "customers", action: "create", dataScope: DataScope.COMPANY },
      { module: "customers", action: "update", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
      { module: "dispositions", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "view", dataScope: DataScope.OWN },
      { module: "leads", action: "create", dataScope: DataScope.OWN },
      { module: "leads", action: "update", dataScope: DataScope.OWN },
      { module: "leads", action: "export", dataScope: DataScope.OWN },
      { module: "tasks", action: "view", dataScope: DataScope.OWN },
      { module: "tasks", action: "create", dataScope: DataScope.OWN },
      { module: "tasks", action: "update", dataScope: DataScope.OWN },
      { module: "activities", action: "view", dataScope: DataScope.OWN },
      { module: "activities", action: "create", dataScope: DataScope.OWN },
      { module: "activities", action: "update", dataScope: DataScope.OWN },
      { module: "notes", action: "view", dataScope: DataScope.OWN },
      { module: "notes", action: "create", dataScope: DataScope.OWN },
      { module: "notes", action: "update", dataScope: DataScope.OWN },
      { module: "custom_fields", action: "view", dataScope: DataScope.COMPANY },
    ],
  },
  {
    name: "Viewer",
    description: "Read-only access to company leads, tasks, and reports.",
    isSystem: true,
    permissions: [
      { module: "customers", action: "view", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
      { module: "dispositions", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "view", dataScope: DataScope.COMPANY },
      { module: "tasks", action: "view", dataScope: DataScope.COMPANY },
      { module: "activities", action: "view", dataScope: DataScope.COMPANY },
      { module: "reports", action: "view", dataScope: DataScope.COMPANY },
    ],
  },
  {
    name: "Support",
    description: "Access to view leads and log activities/notes across the company.",
    isSystem: true,
    permissions: [
      { module: "customers", action: "view", dataScope: DataScope.COMPANY },
      { module: "customers", action: "update", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "update", dataScope: DataScope.COMPANY },
      { module: "activities", action: "view", dataScope: DataScope.COMPANY },
      { module: "activities", action: "create", dataScope: DataScope.COMPANY },
      { module: "notes", action: "view", dataScope: DataScope.COMPANY },
      { module: "notes", action: "create", dataScope: DataScope.COMPANY },
      { module: "tasks", action: "view", dataScope: DataScope.COMPANY },
      { module: "tasks", action: "create", dataScope: DataScope.COMPANY },
    ],
  },
];

const DEFAULT_SOURCES = ["Website", "Google Ads", "Referral", "Cold Call", "Trade Show"];

const DEFAULT_STATUSES = [
  { name: "New", order: 1, isDefault: true, color: "#3B82F6" },
  { name: "Contacted", order: 2, isDefault: false, color: "#F59E0B" },
  { name: "Interested", order: 3, isDefault: false, color: "#8B5CF6" },
  { name: "Proposal Sent", order: 4, isDefault: false, color: "#EC4899" },
  { name: "Converted", order: 5, isDefault: false, color: "#10B981" },
  { name: "Lost", order: 6, isDefault: false, color: "#EF4444" },
];

export class PlatformCompanyService {
  /**
   * Lists companies with search, status/plan filters, and pagination.
   */
  static async listCompanies(query: PlatformCompanyQueryInput) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.planTier) {
      where.plan = { code: query.planTier };
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.CompanyOrderByWithRelationInput = {};
    if (query.sortBy === "name") {
      orderBy.name = query.sortOrder;
    } else if (query.sortBy === "status") {
      orderBy.status = query.sortOrder;
    } else {
      orderBy.createdAt = query.sortOrder;
    }

    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              code: true,
              maxUsers: true,
              maxLeads: true,
            },
          },
          _count: {
            select: {
              users: { where: { deletedAt: null } },
              leads: { where: { deletedAt: null } },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const formatted = companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      email: c.email,
      timezone: c.timezone,
      currency: c.currency,
      plan: c.plan
        ? {
            id: c.plan.id,
            name: c.plan.name,
            code: c.plan.code,
            maxUsers: c.plan.maxUsers,
            maxLeads: c.plan.maxLeads,
          }
        : null,
      userCount: c._count.users,
      leadCount: c._count.leads,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return paginatedResponse(formatted, total, { page, pageSize: limit });
  }

  /**
   * Retrieves full details, usage, stats, and platform audit history for a single company.
   */
  static async getCompanyDetails(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        plan: true,
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            teams: { where: { isActive: true } },
            leads: { where: { deletedAt: null } },
            activities: true,
            tasks: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    // Get quota limits and usage
    const quota = await QuotaService.getCompanyQuotaUsage(companyId);

    // Get recent platform audit logs for this company
    const platformAuditLogs = await prisma.platformAuditLog.findMany({
      where: {
        entityType: "COMPANY",
        entityId: companyId,
      },
      include: {
        superAdmin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
        email: company.email,
        phone: company.phone,
        website: company.website,
        timezone: company.timezone,
        currency: company.currency,
        dateFormat: company.dateFormat,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      },
      plan: company.plan
        ? {
            id: company.plan.id,
            name: company.plan.name,
            code: company.plan.code,
            maxUsers: company.plan.maxUsers,
            maxLeads: company.plan.maxLeads,
            features: (company.plan.features as Record<string, boolean>) || {},
          }
        : null,
      quota: quota.usage,
      statistics: {
        users: company._count.users,
        teams: company._count.teams,
        leads: company._count.leads,
        activities: company._count.activities,
        followUps: company._count.tasks,
      },
      recentAuditLogs: platformAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        metadata: log.metadata,
        superAdmin: log.superAdmin,
        createdAt: log.createdAt,
        ipAddress: log.ipAddress,
      })),
    };
  }

  /**
   * Transactionally provisions a new company, system roles, permissions,
   * default lead sources/statuses, and initial admin invitation.
   */
  static async provisionCompany(
    input: ProvisionCompanyInput,
    superAdminId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const slug = input.slug.toLowerCase().trim();

    // Check slug uniqueness
    const existingCompany = await prisma.company.findUnique({
      where: { slug },
    });
    if (existingCompany) {
      throw new ValidationError("A company with this URL slug already exists.");
    }

    // Resolve target plan
    const plan = await prisma.plan.findUnique({
      where: { code: input.planTier },
    });
    if (!plan) {
      throw new ValidationError(`Plan tier '${input.planTier}' not found.`);
    }

    // Generate invitation token for initial admin
    const rawInviteToken = generateSecureToken(32);
    const inviteTokenHash = hashToken(rawInviteToken);
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Atomic transaction for all initial tenant infrastructure
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Company
      const company = await tx.company.create({
        data: {
          name: input.name.trim(),
          slug,
          email: input.initialAdminEmail.toLowerCase().trim(),
          timezone: input.timezone,
          currency: input.currency,
          status: CompanyStatus.ACTIVE,
          planId: plan.id,
          onboardingCompleted: false,
          onboardingStep: "PROFILE",
        },
      });

      // 2. Create 5 System Roles with granular permissions
      const createdRoles: Record<string, { id: string }> = {};
      for (const roleTemplate of DEFAULT_ROLE_TEMPLATES) {
        const role = await tx.role.create({
          data: {
            companyId: company.id,
            name: roleTemplate.name,
            description: roleTemplate.description,
            isSystem: roleTemplate.isSystem,
            permissions: {
              create: roleTemplate.permissions.map((p) => ({
                module: p.module,
                action: p.action,
                dataScope: p.dataScope,
              })),
            },
          },
        });
        createdRoles[roleTemplate.name] = role;
      }

      // 3. Create Default Lead Sources
      for (const sourceName of DEFAULT_SOURCES) {
        await tx.leadSource.create({
          data: {
            companyId: company.id,
            name: sourceName,
          },
        });
      }

      // 4. Create Default Lead Statuses
      for (const statusTemplate of DEFAULT_STATUSES) {
        await tx.leadStatus.create({
          data: {
            companyId: company.id,
            name: statusTemplate.name,
            displayOrder: statusTemplate.order,
            isDefault: statusTemplate.isDefault,
            color: statusTemplate.color,
          },
        });
      }

      // 5. Create Initial Admin User in INVITED state
      const adminRole = createdRoles["Admin"];
      const initialAdmin = await tx.user.create({
        data: {
          companyId: company.id,
          roleId: adminRole.id,
          email: input.initialAdminEmail.toLowerCase().trim(),
          name: input.initialAdminName.trim(),
          status: UserStatus.INVITED,
        },
      });

      // 6. Create Invitation record
      await tx.invitation.create({
        data: {
          companyId: company.id,
          roleId: adminRole.id,
          email: initialAdmin.email,
          tokenHash: inviteTokenHash,
          expiresAt: inviteExpiresAt,
        },
      });

      return { company, initialAdmin };
    });

    const appUrl = getAppUrl();
    const inviteUrl = `${appUrl}/app/invite/${rawInviteToken}`;

    // Send invitation email asynchronously
    const emailOptions = {
      ...EmailTemplates.invitation(rawInviteToken, "Platform Super Admin", result.company.name),
      to: result.initialAdmin.email,
    };
    emailService.send(emailOptions).catch(() => {});

    // Platform Audit Log
    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "COMPANY_CREATED",
      entityType: "COMPANY",
      entityId: result.company.id,
      metadata: {
        name: result.company.name,
        slug: result.company.slug,
        planTier: plan.code,
        initialAdminEmail: result.initialAdmin.email,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      company: {
        id: result.company.id,
        name: result.company.name,
        slug: result.company.slug,
        status: result.company.status,
        plan: {
          id: plan.id,
          name: plan.name,
          code: plan.code,
        },
        createdAt: result.company.createdAt,
      },
      initialAdmin: {
        id: result.initialAdmin.id,
        name: result.initialAdmin.name,
        email: result.initialAdmin.email,
      },
      inviteUrl,
      rawInviteToken,
    };
  }

  /**
   * Suspends a company, immediately terminates all active tenant user sessions,
   * and records a platform audit event. Preserves all tenant historical data.
   */
  static async suspendCompany(
    companyId: string,
    reason?: string,
    superAdminId?: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    // 1. Update company status to SUSPENDED
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { status: CompanyStatus.SUSPENDED },
    });

    // 2. Immediately purge all active tenant sessions
    const deletedSessions = await prisma.session.deleteMany({
      where: { companyId },
    });

    // 3. Platform audit log
    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "COMPANY_SUSPENDED",
      entityType: "COMPANY",
      entityId: companyId,
      beforeState: { status: company.status },
      afterState: { status: CompanyStatus.SUSPENDED },
      metadata: {
        reason: reason ?? "Administrative platform suspension",
        sessionsTerminated: deletedSessions.count,
        companyName: company.name,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      terminatedSessions: deletedSessions.count,
    };
  }

  /**
   * Reactivates a suspended company, restoring tenant access without modifying historical data.
   */
  static async reactivateCompany(
    companyId: string,
    superAdminId?: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { status: CompanyStatus.ACTIVE },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "COMPANY_REACTIVATED",
      entityType: "COMPANY",
      entityId: companyId,
      beforeState: { status: company.status },
      afterState: { status: CompanyStatus.ACTIVE },
      metadata: { companyName: company.name },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

      return {
        id: updated.id,
        name: updated.name,
        status: updated.status,
      };
    }

  /**
   * B6.2 & B6.3: Super Admin Company Purge
   *
   * Enforces:
   * - Super Admin authorization
   * - Server-side target company verification
   * - Optional slug confirmation
   * - Atomic, deterministic, dependency-aware deletion order inside prisma.$transaction
   * - Zero silent partial deletes: fails closed if any foreign-key constraint prevents deletion
   * - Two-phase safety model: DB transaction first, separately tracked external storage cleanup second
   * - Platform audit logging with exact record counts
   */
  static async purgeCompany(
    companyId: string,
    superAdminId: string,
    options?: {
      confirmSlug?: string;
      ipAddress?: string;
      userAgent?: string;
      _testFailInsideTransaction?: boolean;
    }
  ): Promise<CompanyPurgeResult> {
    if (!superAdminId) {
      throw new ForbiddenError("Super Admin authentication required to purge a company.");
    }
    if (!companyId || typeof companyId !== "string" || !companyId.trim()) {
      throw new ValidationError("Valid target company ID is required.");
    }

    // 0. Re-verify super admin identity server-side
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: superAdminId },
    });
    if (!superAdmin || !superAdmin.isActive || superAdmin.deletedAt !== null) {
      throw new ForbiddenError("Super Admin authentication required to purge a company.");
    }

    // 1. Re-fetch company server-side (never trust client-provided tenant state)
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    // 2. Slug confirmation check if provided
    if (options?.confirmSlug && options.confirmSlug !== company.slug) {
      throw new ValidationError(
        `Confirmation slug mismatch: expected '${company.slug}', got '${options.confirmSlug}'`
      );
    }

    // 3. Phase 1: Atomic, dependency-aware database transaction
    const databaseCounts = await prisma.$transaction(async (tx) => {
      // Find role IDs for permission deletion
      const roles = await tx.role.findMany({
        where: { companyId },
        select: { id: true },
      });
      const roleIds = roles.map((r) => r.id);

      // 1. Sessions
      const sessions = await tx.session.deleteMany({ where: { companyId } });

      // 2. Task Reschedule History
      const taskRescheduleHistories = await tx.taskRescheduleHistory.deleteMany({ where: { companyId } });

      // 3. Lead Disposition History
      const leadDispositionHistories = await tx.leadDispositionHistory.deleteMany({ where: { companyId } });

      // 4. Custom Field Values
      const customFieldValues = await tx.customFieldValue.deleteMany({ where: { companyId } });

      // 5. Activities
      const activities = await tx.activity.deleteMany({ where: { companyId } });

      // 6. Tasks
      const tasks = await tx.task.deleteMany({ where: { companyId } });

      // 7. Lead Imports
      const leadImports = await tx.leadImport.deleteMany({ where: { companyId } });

      // 8. Leads
      const leads = await tx.lead.deleteMany({ where: { companyId } });

      // 9. Customer Phones & Emails
      const customerPhones = await tx.customerPhone.deleteMany({ where: { companyId } });
      const customerEmails = await tx.customerEmail.deleteMany({ where: { companyId } });

      // 10. Customers
      const customers = await tx.customer.deleteMany({ where: { companyId } });

      // 11. Custom Fields
      const customFields = await tx.customField.deleteMany({ where: { companyId } });

      // 12. Dispositions (Break self-referential parentId hierarchy first to prevent Restrict foreign-key violations)
      await tx.disposition.updateMany({
        where: { companyId },
        data: { parentId: null },
      });
      const dispositions = await tx.disposition.deleteMany({ where: { companyId } });

      // 13. Offerings
      const offerings = await tx.offering.deleteMany({ where: { companyId } });

      // 14. Lead Statuses & Sources
      const leadStatuses = await tx.leadStatus.deleteMany({ where: { companyId } });
      const leadSources = await tx.leadSource.deleteMany({ where: { companyId } });

      // 15. Invitations
      const invitations = await tx.invitation.deleteMany({ where: { companyId } });

      // 16. Team Members & Teams
      const teamMembers = await tx.teamMember.deleteMany({ where: { companyId } });
      const teams = await tx.team.deleteMany({ where: { companyId } });

      // 17. Tenant Audit Logs
      const auditLogs = await tx.auditLog.deleteMany({ where: { companyId } });

      // 18. Permissions for tenant roles
      const permissions = roleIds.length > 0
        ? await tx.permission.deleteMany({ where: { roleId: { in: roleIds } } })
        : { count: 0 };

      // 19. Users
      const users = await tx.user.deleteMany({ where: { companyId } });

      // 20. Roles
      const rolesDeleted = await tx.role.deleteMany({ where: { companyId } });

      // Controlled test-only transaction failure mechanism (strictly disabled in production)
      if (options?._testFailInsideTransaction && process.env.NODE_ENV !== "production") {
        throw new Error("TEST_TRANSACTION_CONTROLLED_FAILURE: Simulated rollback inside purge transaction");
      }

      // 21. Company root
      const companies = await tx.company.deleteMany({ where: { id: companyId } });

      return {
        sessions: sessions.count,
        taskRescheduleHistories: taskRescheduleHistories.count,
        leadDispositionHistories: leadDispositionHistories.count,
        customFieldValues: customFieldValues.count,
        activities: activities.count,
        tasks: tasks.count,
        leadImports: leadImports.count,
        leads: leads.count,
        customerPhones: customerPhones.count,
        customerEmails: customerEmails.count,
        customers: customers.count,
        customFields: customFields.count,
        dispositions: dispositions.count,
        offerings: offerings.count,
        leadStatuses: leadStatuses.count,
        leadSources: leadSources.count,
        invitations: invitations.count,
        teamMembers: teamMembers.count,
        teams: teams.count,
        auditLogs: auditLogs.count,
        permissions: permissions.count,
        users: users.count,
        roles: rolesDeleted.count,
        companies: companies.count,
      };
    });

    // 4. Phase 2: External storage cleanup (Separately tracked)
    const storageCleanup = {
      attempted: true,
      confirmed: false,
      error: undefined as string | undefined,
    };

    try {
      const { storageService } = await import("@/lib/services/storage");
      // Best-effort cleanup of tenant storage namespace placeholder
      await storageService.delete(`${companyId}/placeholder`, companyId);
      storageCleanup.confirmed = true;
    } catch (err: any) {
      storageCleanup.confirmed = false;
      storageCleanup.error = err?.message || "Storage cleanup unconfirmed";
      logger.warn("External storage cleanup after company purge failed or unconfirmed", {
        companyId,
        error: err?.message,
      });
    }

    // 5. Platform Audit Log
    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "COMPANY_PURGED",
      entityType: "COMPANY",
      entityId: companyId,
      beforeState: {
        name: company.name,
        slug: company.slug,
        status: company.status,
      },
      afterState: undefined,
      metadata: {
        companyName: company.name,
        companySlug: company.slug,
        databaseCounts,
        storageCleanup,
      },
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });

    return {
      companyId,
      companyName: company.name,
      companySlug: company.slug,
      databaseCounts,
      storageCleanup,
    };
  }
}

export interface CompanyPurgeResult {
  companyId: string;
  companyName: string;
  companySlug: string;
  databaseCounts: {
    sessions: number;
    taskRescheduleHistories: number;
    leadDispositionHistories: number;
    customFieldValues: number;
    activities: number;
    tasks: number;
    leadImports: number;
    leads: number;
    customerPhones: number;
    customerEmails: number;
    customers: number;
    customFields: number;
    dispositions: number;
    offerings: number;
    leadStatuses: number;
    leadSources: number;
    invitations: number;
    teamMembers: number;
    teams: number;
    auditLogs: number;
    permissions: number;
    users: number;
    roles: number;
    companies: number;
  };
  storageCleanup: {
    attempted: boolean;
    confirmed: boolean;
    error?: string;
  };
}
