/**
 * Quota & Subscription Enforcement Service (Slice 8)
 *
 * Implements server-side quota checks and feature-flag gates based on tenant subscription plans.
 * Prevents creation of users or leads beyond allocated plan limits.
 */

import { prisma } from "@/lib/db";
import { QuotaExceededError, NotFoundError } from "@/lib/errors";
import { UserStatus, PlanTier } from "@prisma/client";

export interface QuotaLimitUsage {
  current: number;
  max: number;
  remaining: number;
  isExceeded: boolean;
  percentage: number;
}

export interface CompanyQuotaDetails {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  plan: {
    id: string;
    name: string;
    code: PlanTier;
    maxUsers: number;
    maxLeads: number;
    features: Record<string, boolean>;
  };
  usage: {
    users: QuotaLimitUsage;
    leads: QuotaLimitUsage;
  };
}

export class QuotaService {
  /**
   * Retrieves current usage versus limits for a company.
   */
  static async getCompanyQuotaUsage(companyId: string): Promise<CompanyQuotaDetails> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        plan: true,
      },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    // Default to STARTER tier defaults if company has no plan linked
    const defaultPlan = {
      id: "default",
      name: "Starter",
      code: PlanTier.STARTER,
      maxUsers: 5,
      maxLeads: 1000,
      features: { customFields: true, export: true, analytics: true, auditLogs: true },
    };

    const activePlan = company.plan
      ? {
          id: company.plan.id,
          name: company.plan.name,
          code: company.plan.code,
          maxUsers: company.plan.maxUsers,
          maxLeads: company.plan.maxLeads,
          features: (company.plan.features as Record<string, boolean>) || {},
        }
      : defaultPlan;

    // Concurrently count active non-deleted users and non-deleted leads
    const [userCount, leadCount] = await Promise.all([
      prisma.user.count({
        where: {
          companyId,
          deletedAt: null,
          status: { not: UserStatus.DISABLED },
        },
      }),
      prisma.lead.count({
        where: {
          companyId,
          deletedAt: null,
        },
      }),
    ]);

    const calcUsage = (current: number, max: number): QuotaLimitUsage => {
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

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
      plan: activePlan,
      usage: {
        users: calcUsage(userCount, activePlan.maxUsers),
        leads: calcUsage(leadCount, activePlan.maxLeads),
      },
    };
  }

  /**
   * Evaluates if a company can create an additional user.
   */
  static async checkCanCreateUser(companyId: string): Promise<{ allowed: boolean; reason?: string }> {
    const quota = await this.getCompanyQuotaUsage(companyId);
    if (quota.usage.users.isExceeded) {
      return {
        allowed: false,
        reason: `User seat quota reached (${quota.usage.users.current}/${quota.usage.users.max}). Please upgrade your plan.`,
      };
    }
    return { allowed: true };
  }

  /**
   * Asserts that a company can create a user, throwing QuotaExceededError if blocked.
   */
  static async assertCanCreateUser(companyId: string): Promise<void> {
    const check = await this.checkCanCreateUser(companyId);
    if (!check.allowed) {
      throw new QuotaExceededError(check.reason ?? "User seat quota reached.");
    }
  }

  /**
   * Evaluates if a company can create an additional lead.
   */
  static async checkCanCreateLead(companyId: string): Promise<{ allowed: boolean; reason?: string }> {
    const quota = await this.getCompanyQuotaUsage(companyId);
    if (quota.usage.leads.isExceeded) {
      return {
        allowed: false,
        reason: `Lead capacity limit reached (${quota.usage.leads.current}/${quota.usage.leads.max}). Please upgrade your plan.`,
      };
    }
    return { allowed: true };
  }

  /**
   * Asserts that a company can create a lead, throwing QuotaExceededError if blocked.
   */
  static async assertCanCreateLead(companyId: string): Promise<void> {
    const check = await this.checkCanCreateLead(companyId);
    if (!check.allowed) {
      throw new QuotaExceededError(check.reason ?? "Lead capacity limit reached.");
    }
  }

  /**
   * Evaluates if a company has access to a specific feature flag.
   */
  static async checkCanUseFeature(companyId: string, featureKey: string): Promise<boolean> {
    const quota = await this.getCompanyQuotaUsage(companyId);
    return Boolean(quota.plan.features[featureKey]);
  }

  /**
   * Asserts that a company can use a feature, throwing QuotaExceededError if blocked.
   */
  static async assertCanUseFeature(companyId: string, featureKey: string): Promise<void> {
    const hasFeature = await this.checkCanUseFeature(companyId, featureKey);
    if (!hasFeature) {
      throw new QuotaExceededError(`Feature '${featureKey}' is not available on your current plan.`);
    }
  }
}
