/**
 * Tenant Onboarding Service (Phase B.2)
 *
 * Implements a safe, generic, multi-tenant onboarding workflow for any business type:
 * - Minimum viable tenant setup
 * - First-login detection & state tracking
 * - Stepwise progression with safe resumption / re-entry
 * - Strict tenant isolation & authorization boundaries
 * - Idempotent mutations
 * - Audit logging
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { OnboardingProfileInput } from "@/lib/validations/onboarding";

export interface OnboardingState {
  onboardingCompleted: boolean;
  onboardingStep: string;
  onboardingCompletedAt: Date | null;
  company: {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    timezone: string;
    currency: string;
    defaultCountryCode: string;
    appliedTemplateKey?: string | null;
    appliedTemplateVersion?: number | null;
    appliedTemplateAt?: Date | null;
  };
  metrics: {
    userCount: number;
    teamCount: number;
    offeringCount: number;
    statusCount: number;
    sourceCount: number;
  };
  canManage: boolean;
}

export interface OnboardingCompletionGateResult {
  valid: boolean;
  missingStages: string[];
  reasons: string[];
}

export class OnboardingService {
  /**
   * Evaluates server-side completion gates.
   * Semantic rules:
   * - PROFILE: REQUIRED. Company must have valid name, timezone, currency, country code,
   *   and have progressed beyond the initial unconfigured PROFILE step.
   * - TEAM: OPTIONAL. A tenant may operate as a solo user without additional members.
   * - OFFERINGS: OPTIONAL. A generic CRM may track leads/customers without predefined catalog offerings.
   * - PIPELINE: OPTIONAL. Default lead statuses and sources are auto-provisioned at company creation.
   */
  static validateCompletionGates(company: {
    name: string;
    timezone: string;
    currency: string;
    defaultCountryCode: string;
    onboardingStep: string;
  }): OnboardingCompletionGateResult {
    const missingStages: string[] = [];
    const reasons: string[] = [];

    // Stage 1: PROFILE (REQUIRED)
    const missingProfileFields: string[] = [];
    if (!company.name || company.name.trim().length < 2) {
      missingProfileFields.push("name (min 2 characters)");
    }
    if (!company.timezone || company.timezone.trim().length === 0) {
      missingProfileFields.push("timezone");
    }
    if (!company.currency || company.currency.trim().length !== 3) {
      missingProfileFields.push("currency (3-letter ISO code)");
    }
    if (!company.defaultCountryCode || company.defaultCountryCode.trim().length !== 2) {
      missingProfileFields.push("defaultCountryCode (2-letter ISO code)");
    }

    // Must not be in the initial unconfigured PROFILE step
    if (company.onboardingStep === "PROFILE") {
      missingStages.push("PROFILE");
      reasons.push("The 'PROFILE' stage is required. Company profile must be configured and saved before completion.");
    } else if (missingProfileFields.length > 0) {
      missingStages.push("PROFILE");
      reasons.push(`The 'PROFILE' stage is incomplete: missing required fields [${missingProfileFields.join(", ")}].`);
    }

    // Stages 2, 3, 4 (TEAM, OFFERINGS, PIPELINE) are strictly OPTIONAL for a generic CRM tenant.

    return {
      valid: missingStages.length === 0,
      missingStages,
      reasons,
    };
  }

  /**
   * Asserts administrative permissions for tenant onboarding operations.
   */
  private static assertCanManage(ctx: AuthContext) {
    const isAuthorized =
      ctx.hasPermission("settings", "manage") || ctx.role.name === "Admin";
    if (!isAuthorized) {
      throw new ForbiddenError("Permission denied: Administrative access required for onboarding configuration.");
    }
  }

  /**
   * Retrieves the current onboarding state, progress metrics, and company details for the tenant.
   */
  static async getOnboardingState(ctx: AuthContext): Promise<OnboardingState> {
    const company = await prisma.company.findUnique({
      where: { id: ctx.company.id },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        website: true,
        timezone: true,
        currency: true,
        defaultCountryCode: true,
        onboardingCompleted: true,
        onboardingStep: true,
        onboardingCompletedAt: true,
        appliedTemplateKey: true,
        appliedTemplateVersion: true,
        appliedTemplateAt: true,
        createdAt: true,
      },
    });

    if (!company) {
      throw new NotFoundError("Company record not found.");
    }

    const [userCount, teamCount, offeringCount, statusCount, sourceCount] = await Promise.all([
      prisma.user.count({ where: { companyId: ctx.company.id, deletedAt: null } }),
      prisma.team.count({ where: { companyId: ctx.company.id, isActive: true } }),
      prisma.offering.count({ where: { companyId: ctx.company.id, deletedAt: null } }),
      prisma.leadStatus.count({ where: { companyId: ctx.company.id } }),
      prisma.leadSource.count({ where: { companyId: ctx.company.id } }),
    ]);

    const canManage =
      ctx.hasPermission("settings", "manage") || ctx.role.name === "Admin";

    return {
      onboardingCompleted: company.onboardingCompleted,
      onboardingStep: company.onboardingStep,
      onboardingCompletedAt: company.onboardingCompletedAt,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        email: company.email,
        phone: company.phone,
        website: company.website,
        timezone: company.timezone,
        currency: company.currency,
        defaultCountryCode: company.defaultCountryCode,
        appliedTemplateKey: company.appliedTemplateKey,
        appliedTemplateVersion: company.appliedTemplateVersion,
        appliedTemplateAt: company.appliedTemplateAt,
      },
      metrics: {
        userCount,
        teamCount,
        offeringCount,
        statusCount,
        sourceCount,
      },
      canManage,
    };
  }

  /**
   * Updates company profile during onboarding and advances step to TEAM.
   * Idempotent: repeated submissions update in-place without duplicating records.
   */
  static async updateCompanyProfile(ctx: AuthContext, input: OnboardingProfileInput) {
    this.assertCanManage(ctx);

    const updated = await prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: ctx.company.id },
        data: {
          name: input.name.trim(),
          email: input.email ? input.email.trim().toLowerCase() : null,
          phone: input.phone ? input.phone.trim() : null,
          website: input.website ? input.website.trim() : null,
          timezone: input.timezone,
          currency: input.currency,
          defaultCountryCode: input.defaultCountryCode.toUpperCase(),
          onboardingStep: "TEAM",
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "company.profile_configured",
          entityType: "company",
          entityId: ctx.company.id,
          metadata: {
            name: company.name,
            timezone: company.timezone,
            currency: company.currency,
            defaultCountryCode: company.defaultCountryCode,
          },
        },
      });

      return company;
    });

    return {
      success: true,
      onboardingStep: updated.onboardingStep,
      company: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        website: updated.website,
        timezone: updated.timezone,
        currency: updated.currency,
        defaultCountryCode: updated.defaultCountryCode,
      },
    };
  }

  /**
   * Updates the active onboarding step for safe resumption if abandoned.
   */
  static async setOnboardingStep(ctx: AuthContext, step: string) {
    this.assertCanManage(ctx);

    const validSteps = ["PROFILE", "TEMPLATES", "TEAM", "OFFERINGS", "PIPELINE", "COMPLETED"];
    if (!validSteps.includes(step)) {
      throw new ValidationError(`Invalid onboarding step: ${step}`);
    }

    const company = await prisma.company.update({
      where: { id: ctx.company.id },
      data: { onboardingStep: step },
    });

    return {
      success: true,
      onboardingStep: company.onboardingStep,
    };
  }

  /**
   * Completes the onboarding workflow, activating the tenant workspace.
   * Server-Side Gates:
   * 1. Validates that all REQUIRED stages (PROFILE) are satisfied.
   * 2. Allows OPTIONAL stages (TEAM, OFFERINGS, PIPELINE) to be unconfigured.
   * 3. Idempotent: safe to invoke repeatedly; returns current completion timestamp.
   */
  static async completeOnboarding(ctx: AuthContext) {
    this.assertCanManage(ctx);

    const company = await prisma.company.findUnique({
      where: { id: ctx.company.id },
      select: {
        id: true,
        name: true,
        timezone: true,
        currency: true,
        defaultCountryCode: true,
        onboardingCompleted: true,
        onboardingCompletedAt: true,
        onboardingStep: true,
      },
    });

    if (!company) {
      throw new NotFoundError("Company record not found.");
    }

    // Idempotent shortcut: if already completed, return existing completion state safely
    if (company.onboardingCompleted) {
      return {
        success: true,
        onboardingCompleted: true,
        onboardingCompletedAt: company.onboardingCompletedAt,
        alreadyCompleted: true,
      };
    }

    // Server-Side Gate Check
    const gateCheck = this.validateCompletionGates(company);
    if (!gateCheck.valid) {
      throw new ValidationError(
        `Onboarding completion rejected: ${gateCheck.reasons.join(" ")}`
      );
    }

    const completedAt = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.company.update({
        where: { id: ctx.company.id },
        data: {
          onboardingCompleted: true,
          onboardingStep: "COMPLETED",
          onboardingCompletedAt: completedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "company.onboarding_completed",
          entityType: "company",
          entityId: ctx.company.id,
          metadata: {
            completedAt,
            completedByUserId: ctx.user.id,
            completedByUserName: ctx.user.name,
          },
        },
      });

      return res;
    });

    return {
      success: true,
      onboardingCompleted: updated.onboardingCompleted,
      onboardingCompletedAt: updated.onboardingCompletedAt,
      alreadyCompleted: false,
    };
  }
}
