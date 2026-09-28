/**
 * Platform Plan Management Service (Slice 8)
 *
 * Implements plan definition inspection, quota definition updates,
 * and tenant plan assignment for Super Admins.
 */

import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { PlanTier } from "@prisma/client";
import { UpdatePlanInput } from "@/lib/validations/platform";
import { PlatformAuditLogService } from "./platform-audit-log.service";

export class PlatformPlanService {
  /**
   * Lists all plans with subscriber counts.
   */
  static async listPlans() {
    const plans = await prisma.plan.findMany({
      include: {
        _count: {
          select: {
            companies: true,
          },
        },
      },
      orderBy: { maxUsers: "asc" },
    });

    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      maxUsers: p.maxUsers,
      maxLeads: p.maxLeads,
      features: (p.features as Record<string, boolean>) || {},
      isActive: p.isActive,
      subscriberCount: p._count.companies,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Retrieves a single plan by ID.
   */
  static async getPlanById(planId: string) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        _count: {
          select: {
            companies: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundError("Plan not found.");
    }

    return {
      id: plan.id,
      name: plan.name,
      code: plan.code,
      description: plan.description,
      maxUsers: plan.maxUsers,
      maxLeads: plan.maxLeads,
      features: (plan.features as Record<string, boolean>) || {},
      isActive: plan.isActive,
      subscriberCount: plan._count.companies,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  /**
   * Updates plan quota definitions or features.
   */
  static async updatePlan(
    planId: string,
    input: UpdatePlanInput,
    superAdminId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const existing = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!existing) {
      throw new NotFoundError("Plan not found.");
    }

    const updated = await prisma.plan.update({
      where: { id: planId },
      data: {
        name: input.name !== undefined ? input.name : existing.name,
        description: input.description !== undefined ? input.description : existing.description,
        maxUsers: input.maxUsers !== undefined ? input.maxUsers : existing.maxUsers,
        maxLeads: input.maxLeads !== undefined ? input.maxLeads : existing.maxLeads,
        features: input.features !== undefined ? input.features : existing.features ?? undefined,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "PLAN_UPDATED",
      entityType: "PLAN",
      entityId: planId,
      beforeState: {
        name: existing.name,
        maxUsers: existing.maxUsers,
        maxLeads: existing.maxLeads,
        features: existing.features,
      },
      afterState: {
        name: updated.name,
        maxUsers: updated.maxUsers,
        maxLeads: updated.maxLeads,
        features: updated.features,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return updated;
  }

  /**
   * Assigns a plan to a company.
   */
  static async assignPlanToCompany(
    companyId: string,
    params: { planId?: string; planTier?: PlanTier },
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

    let targetPlan;
    if (params.planId) {
      targetPlan = await prisma.plan.findUnique({ where: { id: params.planId } });
    } else if (params.planTier) {
      targetPlan = await prisma.plan.findUnique({ where: { code: params.planTier } });
    }

    if (!targetPlan) {
      throw new NotFoundError("Target subscription plan not found.");
    }

    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        planId: targetPlan.id,
      },
      include: { plan: true },
    });

    await PlatformAuditLogService.logAction({
      superAdminId,
      action: "PLAN_ASSIGNED",
      entityType: "COMPANY",
      entityId: companyId,
      beforeState: {
        planId: company.planId,
        planCode: company.plan?.code ?? null,
      },
      afterState: {
        planId: targetPlan.id,
        planCode: targetPlan.code,
      },
      metadata: {
        companyName: company.name,
        planName: targetPlan.name,
      },
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    return updatedCompany;
  }
}
