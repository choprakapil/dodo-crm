/**
 * Platform Storage Usage Aggregation Service
 *
 * Implements tenant-by-tenant storage aggregation, real storage quota evaluation,
 * and platform-wide fleet resource telemetry for Super Admins.
 *
 * Zero fake numbers: All metrics are derived from real storage provider instances
 * (local filesystem in non-production, Cloudflare R2 / S3 in production) and real database entities.
 */

import { prisma } from "@/lib/db";
import { storageService } from "@/lib/services/storage";
import { CompanyStatus, UserStatus } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { calculateUsagePercentage, evaluateStorageStatus } from "@/lib/utils/format-bytes";

export interface CompanyStorageReport {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  plan: {
    id: string | null;
    name: string;
    code: string;
  };
  storage: {
    usedBytes: number;
    limitBytes: number | null; // null if unconfigured
    availableBytes: number | null; // null if limit is unconfigured
    usagePercentage: number | null; // null if limit is unconfigured
    fileCount: number;
    status: "HEALTHY" | "NEAR_LIMIT" | "CRITICAL_90" | "OVER_LIMIT" | "LIMIT_NOT_CONFIGURED";
    categories: Record<string, { usedBytes: number; fileCount: number }>;
  };
  userCount: number;
  maxUsers: number;
  leadCount: number;
  maxLeads: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformUsageSummary {
  platform: {
    totalOrganizations: number;
    activeOrganizations: number;
    suspendedOrganizations: number;
    totalStorageUsedBytes: number;
    totalStorageLimitBytes: number | null;
    totalFiles: number;
    organizationsNearLimit: number;
    organizationsOverLimit: number;
    storageProvider: "local" | "r2";
    generatedAt: string;
  };
  organizations: CompanyStorageReport[];
  generatedAt: string;
}

export class PlatformUsageService {
  /**
   * Aggregates storage consumption and capacity telemetry across all organizations.
   */
  static async getPlatformUsageTelemetry(): Promise<PlatformUsageSummary> {
    const generatedAt = new Date().toISOString();

    // 1. Concurrently fetch all companies with their plans & counts, plus storage provider data
    const [companies, storageUsage] = await Promise.all([
      prisma.company.findMany({
        include: {
          plan: true,
          _count: {
            select: {
              users: {
                where: {
                  deletedAt: null,
                  status: { not: UserStatus.DISABLED },
                },
              },
              leads: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      storageService.getPlatformStorageUsage(),
    ]);

    let platformConfiguredLimitSum = 0;
    let hasAnyConfiguredLimit = false;
    let organizationsNearLimit = 0;
    let organizationsOverLimit = 0;
    let activeOrgs = 0;
    let suspendedOrgs = 0;

    const organizationReports: CompanyStorageReport[] = companies.map((company) => {
      if (company.status === CompanyStatus.ACTIVE) {
        activeOrgs++;
      } else {
        suspendedOrgs++;
      }

      // 2. Resolve measured storage from storage service
      const companyStats = storageUsage.byCompany[company.id] || {
        usedBytes: 0,
        fileCount: 0,
        categories: {},
      };

      const usedBytes = Math.max(0, companyStats.usedBytes);
      const fileCount = Math.max(0, companyStats.fileCount);
      const categories = companyStats.categories || {};

      // 3. Resolve configured storage limit (from overrides or plan features)
      const previewData = (company.historyPreviewFields as Record<string, any>) || {};
      const overrides: Record<string, number> = previewData.__limitOverrides || {};
      const planFeatures = (company.plan?.features as Record<string, any>) || {};

      let limitBytes: number | null = null;

      // Check explicit overrides first
      if (typeof overrides.maxStorageBytes === "number" && overrides.maxStorageBytes > 0) {
        limitBytes = overrides.maxStorageBytes;
      } else if (typeof overrides.storageLimitBytes === "number" && overrides.storageLimitBytes > 0) {
        limitBytes = overrides.storageLimitBytes;
      } else if (typeof overrides.maxStorage === "number" && overrides.maxStorage > 0) {
        limitBytes = overrides.maxStorage;
      } else if (typeof overrides.storageLimit === "number" && overrides.storageLimit > 0) {
        limitBytes = overrides.storageLimit;
      } else if (typeof planFeatures.storageLimitBytes === "number" && planFeatures.storageLimitBytes > 0) {
        limitBytes = planFeatures.storageLimitBytes;
      } else if (typeof planFeatures.maxStorageBytes === "number" && planFeatures.maxStorageBytes > 0) {
        limitBytes = planFeatures.maxStorageBytes;
      } else if (typeof planFeatures.storageLimit === "number" && planFeatures.storageLimit > 0) {
        limitBytes = planFeatures.storageLimit;
      }

      if (limitBytes !== null) {
        hasAnyConfiguredLimit = true;
        platformConfiguredLimitSum += limitBytes;
      }

      const usagePercentage = calculateUsagePercentage(usedBytes, limitBytes);
      const availableBytes = limitBytes !== null ? Math.max(0, limitBytes - usedBytes) : null;
      const status = evaluateStorageStatus(usedBytes, limitBytes);

      if (status === "NEAR_LIMIT" || status === "CRITICAL_90") {
        organizationsNearLimit++;
      } else if (status === "OVER_LIMIT") {
        organizationsOverLimit++;
      }

      const planName = company.plan?.name || "Starter";
      const planCode = company.plan?.code || "STARTER";
      const maxUsers = company.plan?.maxUsers ?? 5;
      const maxLeads = company.plan?.maxLeads ?? 1000;

      return {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
        plan: {
          id: company.plan?.id ?? null,
          name: planName,
          code: planCode,
        },
        storage: {
          usedBytes,
          limitBytes,
          availableBytes,
          usagePercentage,
          fileCount,
          status,
          categories,
        },
        userCount: company._count.users,
        maxUsers,
        leadCount: company._count.leads,
        maxLeads,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      };
    });

    return {
      platform: {
        totalOrganizations: companies.length,
        activeOrganizations: activeOrgs,
        suspendedOrganizations: suspendedOrgs,
        totalStorageUsedBytes: storageUsage.totalBytes,
        totalStorageLimitBytes: hasAnyConfiguredLimit ? platformConfiguredLimitSum : null,
        totalFiles: storageUsage.totalFiles,
        organizationsNearLimit,
        organizationsOverLimit,
        storageProvider: storageUsage.storageProvider,
        generatedAt,
      },
      organizations: organizationReports,
      generatedAt,
    };
  }

  /**
   * Retrieves single company storage breakdown.
   */
  static async getCompanyStorageUsage(companyId: string): Promise<CompanyStorageReport> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        plan: true,
        _count: {
          select: {
            users: {
              where: {
                deletedAt: null,
                status: { not: UserStatus.DISABLED },
              },
            },
            leads: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    const companyStats = await storageService.getCompanyStorageUsage(company.id);

    const previewData = (company.historyPreviewFields as Record<string, any>) || {};
    const overrides: Record<string, number> = previewData.__limitOverrides || {};
    const planFeatures = (company.plan?.features as Record<string, any>) || {};

    let limitBytes: number | null = null;
    if (typeof overrides.maxStorageBytes === "number" && overrides.maxStorageBytes > 0) {
      limitBytes = overrides.maxStorageBytes;
    } else if (typeof overrides.storageLimitBytes === "number" && overrides.storageLimitBytes > 0) {
      limitBytes = overrides.storageLimitBytes;
    } else if (typeof planFeatures.storageLimitBytes === "number" && planFeatures.storageLimitBytes > 0) {
      limitBytes = planFeatures.storageLimitBytes;
    }

    const usedBytes = Math.max(0, companyStats.usedBytes);
    const fileCount = Math.max(0, companyStats.fileCount);
    const usagePercentage = calculateUsagePercentage(usedBytes, limitBytes);
    const availableBytes = limitBytes !== null ? Math.max(0, limitBytes - usedBytes) : null;
    const status = evaluateStorageStatus(usedBytes, limitBytes);

    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      plan: {
        id: company.plan?.id ?? null,
        name: company.plan?.name || "Starter",
        code: company.plan?.code || "STARTER",
      },
      storage: {
        usedBytes,
        limitBytes,
        availableBytes,
        usagePercentage,
        fileCount,
        status,
        categories: companyStats.categories,
      },
      userCount: company._count.users,
      maxUsers: company.plan?.maxUsers ?? 5,
      leadCount: company._count.leads,
      maxLeads: company.plan?.maxLeads ?? 1000,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  }
}
