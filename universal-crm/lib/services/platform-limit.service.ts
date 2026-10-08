/**
 * Platform Limit & Quota Management Service
 *
 * Provides centralized definition of SaaS system limits, organization-level overrides,
 * server-side capacity assertion, and real-time usage metrics with warning thresholds.
 */

import { prisma } from "@/lib/db";
import { NotFoundError, QuotaExceededError } from "@/lib/errors";
import { UserStatus, PlanTier } from "@prisma/client";
import { PlatformAuditLogService } from "./platform-audit-log.service";

export interface LimitMetric {
  key: string;
  name: string;
  category: "SEATS" | "DATA" | "CATALOG" | "SYSTEM";
  unit: string;
  planDefault: number;
  override: number | null; // null = use plan default; -1 = unlimited
  effective: number;
  current: number;
  remaining: number;
  percentage: number;
  status: "NORMAL" | "WARNING_80" | "CRITICAL_90" | "EXCEEDED";
}

export interface CompanyLimitUsageReport {
  company: {
    id: string;
    name: string;
    slug: string;
    planName: string;
    planTier: PlanTier;
  };
  limits: LimitMetric[];
  hasWarnings: boolean;
  hasExceeded: boolean;
}

export class PlatformLimitService {
  /**
   * Generates a complete limits and usage report for an organization.
   */
  static async getCompanyLimits(companyId: string): Promise<CompanyLimitUsageReport> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: true },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    const planTier = company.plan?.code ?? PlanTier.STARTER;
    const planName = company.plan?.name ?? "Starter";
    const planMaxUsers = company.plan?.maxUsers ?? 5;
    const planMaxLeads = company.plan?.maxLeads ?? 1000;

    // Concurrently count all entity usages
    const [
      userCount,
      leadCount,
      customerCount,
      teamCount,
      productCount,
      serviceCount,
      dispositionCount,
      customFieldCount,
      auditLogCount,
    ] = await Promise.all([
      prisma.user.count({ where: { companyId, deletedAt: null, status: { not: UserStatus.DISABLED } } }),
      prisma.lead.count({ where: { companyId, deletedAt: null } }),
      prisma.customer.count({ where: { companyId } }),
      prisma.team.count({ where: { companyId, isActive: true } }),
      prisma.offering.count({ where: { companyId, type: "PRODUCT", isActive: true } }),
      prisma.offering.count({ where: { companyId, type: "SERVICE", isActive: true } }),
      prisma.disposition.count({ where: { companyId, isActive: true } }),
      prisma.customField.count({ where: { companyId, deletedAt: null } }),
      prisma.auditLog.count({ where: { companyId } }),
    ]);

    // Extract overrides stored on company
    const previewData = (company.historyPreviewFields as Record<string, any>) || {};
    const overrides: Record<string, number> = previewData.__limitOverrides || {};

    const buildMetric = (
      key: string,
      name: string,
      category: "SEATS" | "DATA" | "CATALOG" | "SYSTEM",
      unit: string,
      planDefault: number,
      current: number
    ): LimitMetric => {
      const override = overrides[key] !== undefined ? overrides[key] : null;
      let effective = override !== null ? override : planDefault;
      const isUnlimited = effective === -1;

      let percentage = 0;
      let remaining = 0;
      let status: LimitMetric["status"] = "NORMAL";

      if (isUnlimited) {
        percentage = 0;
        remaining = 999999;
        status = "NORMAL";
      } else {
        percentage = effective > 0 ? Math.min(100, Math.round((current / effective) * 100)) : 100;
        remaining = Math.max(0, effective - current);

        if (current >= effective) {
          status = "EXCEEDED";
        } else if (percentage >= 90) {
          status = "CRITICAL_90";
        } else if (percentage >= 80) {
          status = "WARNING_80";
        } else {
          status = "NORMAL";
        }
      }

      return {
        key,
        name,
        category,
        unit,
        planDefault,
        override,
        effective,
        current,
        remaining,
        percentage,
        status,
      };
    };

    const limits: LimitMetric[] = [
      buildMetric("maxUsers", "Active User Seats", "SEATS", "Seats", planMaxUsers, userCount),
      buildMetric("maxLeads", "Lead Pipeline Capacity", "DATA", "Leads", planMaxLeads, leadCount),
      buildMetric("maxCustomers", "Customer Database Records", "DATA", "Customers", planTier === "ENTERPRISE" ? 10000 : planTier === "PROFESSIONAL" ? 5000 : 1000, customerCount),
      buildMetric("maxTeams", "Organizational Teams", "SEATS", "Teams", planTier === "ENTERPRISE" ? 50 : planTier === "PROFESSIONAL" ? 20 : 5, teamCount),
      buildMetric("maxProducts", "Product Catalog Offerings", "CATALOG", "Products", planTier === "ENTERPRISE" ? 1000 : planTier === "PROFESSIONAL" ? 250 : 50, productCount),
      buildMetric("maxServices", "Service Offerings", "CATALOG", "Services", planTier === "ENTERPRISE" ? 500 : planTier === "PROFESSIONAL" ? 100 : 25, serviceCount),
      buildMetric("maxDispositions", "Call Dispositions", "SYSTEM", "Dispositions", planTier === "ENTERPRISE" ? 200 : 50, dispositionCount),
      buildMetric("maxCustomFields", "Custom Field Definitions", "SYSTEM", "Fields", planTier === "ENTERPRISE" ? 100 : planTier === "PROFESSIONAL" ? 50 : 15, customFieldCount),
    ];

    const hasWarnings = limits.some((l) => l.status === "WARNING_80" || l.status === "CRITICAL_90");
    const hasExceeded = limits.some((l) => l.status === "EXCEEDED");

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        planName,
        planTier,
      },
      limits,
      hasWarnings,
      hasExceeded,
    };
  }

  /**
   * Asserts whether an entity creation is allowed by the organization's effective limits.
   */
  static async assertLimit(companyId: string, limitKey: string): Promise<void> {
    const report = await this.getCompanyLimits(companyId);
    const metric = report.limits.find((l) => l.key === limitKey);

    if (metric && metric.status === "EXCEEDED") {
      throw new QuotaExceededError(
        `Plan limit reached for ${metric.name} (${metric.current}/${metric.effective} ${metric.unit}). Please upgrade plan or request limit increase.`
      );
    }
  }

  /**
   * Sets custom limit overrides for an organization.
   */
  static async setCompanyLimitOverrides(
    companyId: string,
    limitOverrides: Record<string, number>,
    superAdminId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    const currentPreview = (company.historyPreviewFields as Record<string, any>) || {};

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        historyPreviewFields: {
          ...currentPreview,
          __limitOverrides: limitOverrides,
        },
      },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "COMPANY_LIMITS_UPDATED",
      entityType: "COMPANY",
      entityId: companyId,
      metadata: {
        companyName: company.name,
        limitOverrides,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return updated;
  }
}
