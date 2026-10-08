/**
 * Platform Feature Management Service
 *
 * Provides a structured catalog of SaaS platform capabilities, categories,
 * plan default matrices, and organization-level feature overrides.
 */

import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { PlatformAuditLogService } from "./platform-audit-log.service";

export interface PlatformFeatureDefinition {
  key: string;
  name: string;
  description: string;
  category: "CRM" | "COMMUNICATION" | "REPORTING" | "AUTOMATION" | "SECURITY" | "ADMINISTRATION" | "INTEGRATION" | "ADVANCED";
  defaultTiers: ("FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE")[];
}

export const PLATFORM_FEATURE_CATALOG: PlatformFeatureDefinition[] = [
  // CRM
  {
    key: "leads",
    name: "Leads Management",
    description: "Lead capture, pipeline tracking, status workflows, and assignment.",
    category: "CRM",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "customers",
    name: "Customer 360",
    description: "Unified customer identity, contact directory, and multi-channel history.",
    category: "CRM",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "deals",
    name: "Deals & Pipeline",
    description: "Multi-stage visual Kanban pipeline with deal stage progression.",
    category: "CRM",
    defaultTiers: ["STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "dispositions",
    name: "Hierarchical Dispositions",
    description: "3-tier call outcomes with mandatory follow-up gatekeeping.",
    category: "CRM",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "customFields",
    name: "Custom Fields Engine",
    description: "Configurable entity attributes across 11 field data types.",
    category: "CRM",
    defaultTiers: ["STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "offerings",
    name: "Products & Services",
    description: "Commercial product catalog, SKU tracking, and sales price controls.",
    category: "CRM",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },

  // Communication & Collaboration
  {
    key: "calling",
    name: "Click-to-Call / Call Logging",
    description: "Structured call outcome tracking and phone normalization.",
    category: "COMMUNICATION",
    defaultTiers: ["STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "emailIntegration",
    name: "Email Communication",
    description: "Email compose, customer email timeline, and notification dispatch.",
    category: "COMMUNICATION",
    defaultTiers: ["PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "commentsMentions",
    name: "Comments & @Mentions",
    description: "Internal team collaboration threads with author grace periods.",
    category: "COMMUNICATION",
    defaultTiers: ["STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "notifications",
    name: "In-App Notifications",
    description: "Real-time activity alerts, task reminders, and deep-link routing.",
    category: "COMMUNICATION",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },

  // Reporting & Analytics
  {
    key: "analytics",
    name: "Executive Analytics Dashboard",
    description: "Lead trends, conversion ratios, pipeline velocity, and team leaderboards.",
    category: "REPORTING",
    defaultTiers: ["STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "advancedReports",
    name: "Advanced Scoped Reports",
    description: "Multi-dimensional performance reports with custom date presets.",
    category: "REPORTING",
    defaultTiers: ["PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "export",
    name: "CSV Data Export",
    description: "Export filtered leads, analytics data, and audit records to CSV.",
    category: "REPORTING",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },

  // Administration & Security
  {
    key: "teams",
    name: "Team Management",
    description: "Departmental team grouping, manager hierarchies, and team scopes.",
    category: "ADMINISTRATION",
    defaultTiers: ["STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "customRoles",
    name: "Custom Role Builder",
    description: "Granular action matrix (view, create, update, delete) and data scopes.",
    category: "SECURITY",
    defaultTiers: ["PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "auditLogs",
    name: "Compliance Audit Trail",
    description: "Immutable tenant audit logs recording all state mutations and logins.",
    category: "SECURITY",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "sessionManagement",
    name: "Active Session Security",
    description: "Device tracking, session introspection, and remote revocation.",
    category: "SECURITY",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },

  // Integration & Advanced
  {
    key: "apiAccess",
    name: "REST API Access",
    description: "Programmatic API tokens and webhook integrations.",
    category: "INTEGRATION",
    defaultTiers: ["PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "leadImport",
    name: "Bulk CSV Import Wizard",
    description: "Column mapping, preview validation, and background chunked imports.",
    category: "AUTOMATION",
    defaultTiers: ["STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
  {
    key: "industryTemplates",
    name: "Industry Blueprints",
    description: "One-click tenant seeding for Real Estate, Insurance, SaaS, Healthcare, etc.",
    category: "ADVANCED",
    defaultTiers: ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"],
  },
];

export class PlatformFeatureService {
  /**
   * Returns the master catalog of platform features.
   */
  static getCatalog(): PlatformFeatureDefinition[] {
    return PLATFORM_FEATURE_CATALOG;
  }

  /**
   * Retrieves effective feature flags for an organization.
   * Merges Plan defaults with any Organization-specific overrides.
   */
  static async getEffectiveFeatures(companyId: string): Promise<{
    planFeatures: Record<string, boolean>;
    overrides: Record<string, boolean>;
    effective: Record<string, boolean>;
    catalog: PlatformFeatureDefinition[];
  }> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: true },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    const planFeatures: Record<string, boolean> = {};
    if (company.plan && company.plan.features) {
      Object.assign(planFeatures, company.plan.features as Record<string, boolean>);
    } else {
      // Default tier fallback
      PLATFORM_FEATURE_CATALOG.forEach((f) => {
        planFeatures[f.key] = f.defaultTiers.includes("STARTER");
      });
    }

    // Read organization-specific overrides if configured in historyPreviewFields or dedicated container
    const overrides: Record<string, boolean> = {};
    const companyData = company as any;
    if (companyData.featureOverrides && typeof companyData.featureOverrides === "object") {
      Object.assign(overrides, companyData.featureOverrides);
    }

    // Calculate effective features
    const effective: Record<string, boolean> = {};
    PLATFORM_FEATURE_CATALOG.forEach((f) => {
      if (overrides[f.key] !== undefined) {
        effective[f.key] = overrides[f.key];
      } else {
        effective[f.key] = Boolean(planFeatures[f.key]);
      }
    });

    return {
      planFeatures,
      overrides,
      effective,
      catalog: PLATFORM_FEATURE_CATALOG,
    };
  }

  /**
   * Checks whether a feature is effectively enabled for a company.
   */
  static async isFeatureEnabled(companyId: string, featureKey: string): Promise<boolean> {
    const { effective } = await this.getEffectiveFeatures(companyId);
    return Boolean(effective[featureKey]);
  }

  /**
   * Updates feature overrides for a specific organization.
   */
  static async setCompanyFeatureOverrides(
    companyId: string,
    overrides: Record<string, boolean>,
    superAdminId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: true },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    // Persist overrides in company historyPreviewFields or dedicated field
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        // We preserve existing history fields and merge featureOverrides
        historyPreviewFields: {
          ...((company.historyPreviewFields as Record<string, any>) || {}),
          __featureOverrides: overrides,
        },
      },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "COMPANY_FEATURES_UPDATED",
      entityType: "COMPANY",
      entityId: companyId,
      metadata: {
        companyName: company.name,
        overrides,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return updated;
  }
}
