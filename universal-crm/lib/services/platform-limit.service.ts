/**
 * Platform Limit & Quota Management Service
 *
 * Provides centralized definition of SaaS system limits, organization-level overrides,
 * server-side capacity assertion, and real-time usage metrics with warning thresholds.
 *
 * Delegates canonical resolution and locking to QuotaService.
 */

import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { PlanTier, Prisma } from "@prisma/client";
import { PlatformAuditLogService } from "./platform-audit-log.service";
import { QuotaService, ResolvedLimitMetric } from "./quota.service";
import { ValidLimitKey } from "@/lib/validations/platform";

export type LimitMetric = ResolvedLimitMetric;

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
   * Generates a complete limits and usage report for an organization using canonical QuotaService.
   */
  static async getCompanyLimits(companyId: string): Promise<CompanyLimitUsageReport> {
    const quota = await QuotaService.getCompanyQuotaUsage(companyId);

    const hasWarnings = quota.metrics.some(
      (l) => l.status === "WARNING_80" || l.status === "CRITICAL_90"
    );
    const hasExceeded = quota.metrics.some((l) => l.status === "EXCEEDED");

    return {
      company: quota.company,
      limits: quota.metrics,
      hasWarnings,
      hasExceeded,
    };
  }

  /**
   * Asserts whether an entity creation is allowed by the organization's effective limits.
   */
  static async assertLimit(
    companyId: string,
    limitKey: string,
    additionalCount = 1,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    await QuotaService.assertLimit(companyId, limitKey as ValidLimitKey, additionalCount, tx);
  }

  /**
   * Sets custom limit overrides for an organization in dedicated Company.limitOverrides column.
   * Completely preserves Company.historyPreviewFields and other tenant configurations.
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

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        limitOverrides: limitOverrides as Prisma.InputJsonValue,
      } as any,
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
