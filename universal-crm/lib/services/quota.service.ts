/**
 * Quota & Subscription Enforcement Service (Phase 3 Unified Quota Governance)
 *
 * Implements canonical server-side quota checks, organization override resolution,
 * plan inheritance, and feature-flag gates across all tenant mutation entry points.
 *
 * Concurrency protection: Serializes tenant quota increments using MySQL InnoDB
 * exclusive row locking (SELECT id FROM companies WHERE id = ? FOR UPDATE).
 */

import { prisma } from "@/lib/db";
import { QuotaExceededError, NotFoundError } from "@/lib/errors";
import { UserStatus, PlanTier, Prisma } from "@prisma/client";
import {
  VALID_LIMIT_KEYS,
  VALID_FEATURE_KEYS,
  ValidLimitKey,
  ValidFeatureKey,
} from "@/lib/validations/platform";
import { PLATFORM_FEATURE_CATALOG } from "./platform-feature.service";

export interface QuotaLimitUsage {
  current: number;
  max: number; // -1 = unlimited
  remaining: number;
  isExceeded: boolean;
  percentage: number;
}

export interface ResolvedLimitMetric {
  key: ValidLimitKey;
  name: string;
  category: "SEATS" | "DATA" | "CATALOG" | "SYSTEM";
  unit: string;
  planDefault: number;
  override: number | null; // null = plan default; -1 = unlimited
  effective: number; // -1 = unlimited
  current: number;
  remaining: number;
  percentage: number;
  status: "NORMAL" | "WARNING_80" | "CRITICAL_90" | "EXCEEDED";
}

export interface CompanyQuotaDetails {
  company: {
    id: string;
    name: string;
    slug: string;
    planName: string;
    planTier: PlanTier;
  };
  plan: {
    id: string;
    name: string;
    code: PlanTier;
    maxUsers: number;
    maxLeads: number;
    features: Record<string, boolean>;
  };
  overrides: {
    limits: Record<string, number>;
    features: Record<string, boolean>;
  };
  effectiveLimits: Record<ValidLimitKey, number>;
  effectiveFeatures: Record<ValidFeatureKey, boolean>;
  usage: {
    users: QuotaLimitUsage;
    leads: QuotaLimitUsage;
    customers: QuotaLimitUsage;
    teams: QuotaLimitUsage;
    products: QuotaLimitUsage;
    services: QuotaLimitUsage;
    dispositions: QuotaLimitUsage;
    customFields: QuotaLimitUsage;
  };
  metrics: ResolvedLimitMetric[];
}

export class QuotaService {
  /**
   * Acquires an exclusive row lock on the Company in MySQL InnoDB to serialize
   * concurrent quota checks and mutations within a transaction.
   */
  static async acquireCompanyQuotaLock(
    companyId: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    await tx.$executeRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
  }

  /**
   * Canonical resolver for organization limits and feature overrides.
   *
   * Precedence:
   * 1. Valid organization override (dedicated column: Company.limitOverrides / Company.featureOverrides)
   * 2. Legacy fallback in historyPreviewFields (if dedicated is null)
   * 3. Valid assigned Plan defaults (Company.plan)
   * 4. Fails closed if plan relation is missing/invalid.
   */
  static async resolveCompanyLimits(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{
    company: any;
    plan: any;
    limitOverrides: Record<string, number>;
    featureOverrides: Record<string, boolean>;
    effectiveLimits: Record<ValidLimitKey, number>;
    effectiveFeatures: Record<ValidFeatureKey, boolean>;
  }> {
    const client = tx || prisma;
    const company = await client.company.findUnique({
      where: { id: companyId },
      include: { plan: true },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    // Plan Resolution Gate: Never silently treat missing/corrupt plan as STARTER!
    if (!company.plan || !company.plan.isActive) {
      throw new QuotaExceededError(
        "Organization has no valid active subscription plan assigned. Operation blocked."
      );
    }

    const plan = company.plan;

    // 1. Resolve Limit Overrides (Dedicated column first, legacy fallback second)
    const limitOverrides: Record<string, number> = {};
    const legacyPreview = (company.historyPreviewFields as Record<string, any>) || {};

    let rawLimits: any = (company as any).limitOverrides;
    if (!rawLimits || typeof rawLimits !== "object" || Array.isArray(rawLimits)) {
      rawLimits = legacyPreview.__limitOverrides || legacyPreview.limitOverrides || {};
    }

    if (rawLimits && typeof rawLimits === "object" && !Array.isArray(rawLimits)) {
      for (const [k, v] of Object.entries(rawLimits)) {
        if (!VALID_LIMIT_KEYS.includes(k as ValidLimitKey)) continue;
        if (typeof v === "number" && Number.isInteger(v)) {
          if (v === -1 || v >= 0) {
            limitOverrides[k] = v;
          } else {
            // Negative value other than -1 is malformed -> reject/fail closed by setting limit to 0
            limitOverrides[k] = 0;
          }
        } else {
          // Non-integer or non-number is malformed -> fail closed
          limitOverrides[k] = 0;
        }
      }
    }

    // 2. Resolve Feature Overrides (Dedicated column first, legacy fallback second)
    const featureOverrides: Record<string, boolean> = {};
    let rawFeatures: any = (company as any).featureOverrides;
    if (!rawFeatures || typeof rawFeatures !== "object" || Array.isArray(rawFeatures)) {
      rawFeatures = legacyPreview.__featureOverrides || legacyPreview.featureOverrides || {};
    }

    if (rawFeatures && typeof rawFeatures === "object" && !Array.isArray(rawFeatures)) {
      for (const [k, v] of Object.entries(rawFeatures)) {
        if (!VALID_FEATURE_KEYS.includes(k as ValidFeatureKey)) continue;
        if (typeof v === "boolean") {
          featureOverrides[k] = v;
        }
      }
    }

    // Plan-tier default limit matrix
    const planTier: PlanTier = plan.code;
    const planDefaults: Record<ValidLimitKey, number> = {
      maxUsers: plan.maxUsers,
      maxLeads: plan.maxLeads,
      maxCustomers: planTier === "ENTERPRISE" ? 10000 : planTier === "PROFESSIONAL" ? 5000 : 1000,
      maxTeams: planTier === "ENTERPRISE" ? 50 : planTier === "PROFESSIONAL" ? 20 : 5,
      maxProducts: planTier === "ENTERPRISE" ? 1000 : planTier === "PROFESSIONAL" ? 250 : 50,
      maxServices: planTier === "ENTERPRISE" ? 500 : planTier === "PROFESSIONAL" ? 100 : 25,
      maxDispositions: planTier === "ENTERPRISE" ? 200 : planTier === "PROFESSIONAL" ? 100 : 50,
      maxCustomFields: planTier === "ENTERPRISE" ? 100 : planTier === "PROFESSIONAL" ? 50 : 15,
    };

    // Calculate effective limits
    const effectiveLimits: Record<ValidLimitKey, number> = {} as any;
    for (const key of VALID_LIMIT_KEYS) {
      if (limitOverrides[key] !== undefined) {
        effectiveLimits[key] = limitOverrides[key];
      } else {
        effectiveLimits[key] = planDefaults[key];
      }
    }

    // Calculate effective features
    const effectiveFeatures: Record<ValidFeatureKey, boolean> = {} as any;
    const planFeatures = (plan.features as Record<string, boolean>) || {};

    for (const f of PLATFORM_FEATURE_CATALOG) {
      const fKey = f.key as ValidFeatureKey;
      if (featureOverrides[fKey] !== undefined) {
        effectiveFeatures[fKey] = featureOverrides[fKey];
      } else if (planFeatures[fKey] !== undefined) {
        effectiveFeatures[fKey] = Boolean(planFeatures[fKey]);
      } else {
        effectiveFeatures[fKey] = f.defaultTiers.includes(planTier);
      }
    }

    return {
      company,
      plan,
      limitOverrides,
      featureOverrides,
      effectiveLimits,
      effectiveFeatures,
    };
  }

  /**
   * Retrieves current usage versus limits for all 8 catalog metrics.
   */
  static async getCompanyQuotaUsage(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<CompanyQuotaDetails> {
    const client = tx || prisma;
    const resolution = await this.resolveCompanyLimits(companyId, tx);
    const { company, plan, limitOverrides, featureOverrides, effectiveLimits, effectiveFeatures } =
      resolution;

    // Concurrently count all entity usages per existing counting rules
    const [
      userCount,
      leadCount,
      customerCount,
      teamCount,
      productCount,
      serviceCount,
      dispositionCount,
      customFieldCount,
    ] = await Promise.all([
      // Users: Active + Invited occupy seats; Disabled and soft-deleted are excluded
      client.user.count({
        where: {
          companyId,
          deletedAt: null,
          status: { not: UserStatus.DISABLED },
        },
      }),
      // Leads: Non-deleted leads
      client.lead.count({
        where: {
          companyId,
          deletedAt: null,
        },
      }),
      // Customers
      client.customer.count({
        where: { companyId },
      }),
      // Teams: Active teams
      client.team.count({
        where: { companyId, isActive: true },
      }),
      // Products: Offerings of type PRODUCT
      client.offering.count({
        where: { companyId, type: "PRODUCT", isActive: true, deletedAt: null },
      }),
      // Services: Offerings of type SERVICE
      client.offering.count({
        where: { companyId, type: "SERVICE", isActive: true, deletedAt: null },
      }),
      // Dispositions: Active call dispositions
      client.disposition.count({
        where: { companyId, isActive: true },
      }),
      // Custom Fields: Non-deleted definitions
      client.customField.count({
        where: { companyId, deletedAt: null },
      }),
    ]);

    const buildUsage = (current: number, max: number): QuotaLimitUsage => {
      const isUnlimited = max === -1;
      if (isUnlimited) {
        return {
          current,
          max: -1,
          remaining: 999999,
          isExceeded: false,
          percentage: 0,
        };
      }
      const remaining = Math.max(0, max - current);
      const percentage = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 100;
      return {
        current,
        max,
        remaining,
        isExceeded: current >= max,
        percentage,
      };
    };

    const buildMetric = (
      key: ValidLimitKey,
      name: string,
      category: "SEATS" | "DATA" | "CATALOG" | "SYSTEM",
      unit: string,
      current: number
    ): ResolvedLimitMetric => {
      const effective = effectiveLimits[key];
      const override = limitOverrides[key] !== undefined ? limitOverrides[key] : null;
      const isUnlimited = effective === -1;

      let percentage = 0;
      let remaining = 0;
      let status: ResolvedLimitMetric["status"] = "NORMAL";

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
        }
      }

      return {
        key,
        name,
        category,
        unit,
        planDefault: plan[key] ?? 0,
        override,
        effective,
        current,
        remaining,
        percentage,
        status,
      };
    };

    const metrics: ResolvedLimitMetric[] = [
      buildMetric("maxUsers", "Active User Seats", "SEATS", "Seats", userCount),
      buildMetric("maxLeads", "Lead Pipeline Capacity", "DATA", "Leads", leadCount),
      buildMetric("maxCustomers", "Customer Database Records", "DATA", "Customers", customerCount),
      buildMetric("maxTeams", "Organizational Teams", "SEATS", "Teams", teamCount),
      buildMetric("maxProducts", "Product Offerings", "CATALOG", "Products", productCount),
      buildMetric("maxServices", "Service Offerings", "CATALOG", "Services", serviceCount),
      buildMetric("maxDispositions", "Call Dispositions", "SYSTEM", "Dispositions", dispositionCount),
      buildMetric("maxCustomFields", "Custom Fields", "SYSTEM", "Fields", customFieldCount),
    ];

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        planName: plan.name,
        planTier: plan.code,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        code: plan.code,
        maxUsers: plan.maxUsers,
        maxLeads: plan.maxLeads,
        features: (plan.features as Record<string, boolean>) || {},
      },
      overrides: {
        limits: limitOverrides,
        features: featureOverrides,
      },
      effectiveLimits,
      effectiveFeatures,
      usage: {
        users: buildUsage(userCount, effectiveLimits.maxUsers),
        leads: buildUsage(leadCount, effectiveLimits.maxLeads),
        customers: buildUsage(customerCount, effectiveLimits.maxCustomers),
        teams: buildUsage(teamCount, effectiveLimits.maxTeams),
        products: buildUsage(productCount, effectiveLimits.maxProducts),
        services: buildUsage(serviceCount, effectiveLimits.maxServices),
        dispositions: buildUsage(dispositionCount, effectiveLimits.maxDispositions),
        customFields: buildUsage(customFieldCount, effectiveLimits.maxCustomFields),
      },
      metrics,
    };
  }

  /**
   * Asserts that a company can create N additional leads.
   * Serializes concurrency via InnoDB row lock when tx is provided.
   */
  static async assertCanCreateLead(
    companyId: string,
    additionalCount = 1,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;
    if (tx) {
      await this.acquireCompanyQuotaLock(companyId, tx);
    }

    const resolution = await this.resolveCompanyLimits(companyId, tx);
    const maxLeads = resolution.effectiveLimits.maxLeads;

    if (maxLeads === -1) {
      return; // Unlimited quota
    }

    const currentCount = await client.lead.count({
      where: {
        companyId,
        deletedAt: null,
      },
    });

    if (currentCount + additionalCount > maxLeads) {
      throw new QuotaExceededError(
        `Lead pipeline capacity exceeded (${currentCount}/${maxLeads}, requested +${additionalCount}). Please upgrade your plan or request a quota increase.`,
        { limitKey: "maxLeads", limit: maxLeads, current: currentCount }
      );
    }
  }

  /**
   * Asserts that a company can create N additional user seats.
   * Serializes concurrency via InnoDB row lock when tx is provided.
   */
  static async assertCanCreateUser(
    companyId: string,
    additionalCount = 1,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;
    if (tx) {
      await this.acquireCompanyQuotaLock(companyId, tx);
    }

    const resolution = await this.resolveCompanyLimits(companyId, tx);
    const maxUsers = resolution.effectiveLimits.maxUsers;

    if (maxUsers === -1) {
      return; // Unlimited seats
    }

    const currentCount = await client.user.count({
      where: {
        companyId,
        deletedAt: null,
        status: { not: UserStatus.DISABLED },
      },
    });

    if (currentCount + additionalCount > maxUsers) {
      throw new QuotaExceededError(
        `User seat quota exceeded (${currentCount}/${maxUsers}, requested +${additionalCount}). Please upgrade your plan or request additional seats.`,
        { limitKey: "maxUsers", limit: maxUsers, current: currentCount }
      );
    }
  }

  /**
   * Universal assertLimit for any of the 8 catalog metrics.
   * Serializes concurrency via InnoDB row lock when tx is provided.
   */
  static async assertLimit(
    companyId: string,
    limitKey: ValidLimitKey,
    additionalCount = 1,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;
    if (tx) {
      await this.acquireCompanyQuotaLock(companyId, tx);
    }

    const resolution = await this.resolveCompanyLimits(companyId, tx);
    const effectiveMax = resolution.effectiveLimits[limitKey];

    if (effectiveMax === -1) {
      return; // Unlimited
    }

    let currentCount = 0;
    switch (limitKey) {
      case "maxUsers":
        currentCount = await client.user.count({
          where: { companyId, deletedAt: null, status: { not: UserStatus.DISABLED } },
        });
        break;
      case "maxLeads":
        currentCount = await client.lead.count({
          where: { companyId, deletedAt: null },
        });
        break;
      case "maxCustomers":
        currentCount = await client.customer.count({
          where: { companyId },
        });
        break;
      case "maxTeams":
        currentCount = await client.team.count({
          where: { companyId, isActive: true },
        });
        break;
      case "maxProducts":
        currentCount = await client.offering.count({
          where: { companyId, type: "PRODUCT", isActive: true, deletedAt: null },
        });
        break;
      case "maxServices":
        currentCount = await client.offering.count({
          where: { companyId, type: "SERVICE", isActive: true, deletedAt: null },
        });
        break;
      case "maxDispositions":
        currentCount = await client.disposition.count({
          where: { companyId, isActive: true },
        });
        break;
      case "maxCustomFields":
        currentCount = await client.customField.count({
          where: { companyId, deletedAt: null },
        });
        break;
      default:
        return;
    }

    if (currentCount + additionalCount > effectiveMax) {
      throw new QuotaExceededError(
        `Quota limit reached for ${limitKey} (${currentCount}/${effectiveMax}, requested +${additionalCount}). Please upgrade plan.`,
        { limitKey, limit: effectiveMax, current: currentCount }
      );
    }
  }

  /**
   * Evaluates if a company has access to a specific feature flag.
   */
  static async checkCanUseFeature(companyId: string, featureKey: string): Promise<boolean> {
    const resolution = await this.resolveCompanyLimits(companyId);
    return Boolean(resolution.effectiveFeatures[featureKey as ValidFeatureKey]);
  }

  /**
   * Asserts that a company has access to a feature, throwing QuotaExceededError if blocked.
   */
  static async assertCanUseFeature(companyId: string, featureKey: string): Promise<void> {
    const isEnabled = await this.checkCanUseFeature(companyId, featureKey);
    if (!isEnabled) {
      throw new QuotaExceededError(
        `Feature '${featureKey}' is not enabled for your organization's subscription plan.`,
        { featureKey }
      );
    }
  }
}
