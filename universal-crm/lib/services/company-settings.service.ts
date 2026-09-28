/**
 * Company Settings Service
 *
 * Implements tenant configuration management, parameter validation,
 * and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { UpdateCompanySettingsInput } from "@/lib/validations/company-settings";
import { Prisma } from "@prisma/client";

export class CompanySettingsService {
  /**
   * Get tenant company profile and settings.
   */
  static async getCompanySettings(ctx: AuthContext) {
    const canView =
      ctx.hasPermission("settings", "view") || ctx.hasPermission("settings", "manage");

    if (!canView) {
      throw new ForbiddenError("Permission denied: settings.view required");
    }

    const company = await prisma.company.findUnique({
      where: { id: ctx.company.id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        email: true,
        phone: true,
        website: true,
        logoUrl: true,
        timezone: true,
        currency: true,
        dateFormat: true,
        allowSalesPriceOverride: true,
        customerDirectoryVisibility: true,
        createEnquiryHistoryEnabled: true,
        historyPreviewFields: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) {
      throw new NotFoundError("Company record not found");
    }

    return company;
  }

  /**
   * Update tenant company settings.
   */
  static async updateCompanySettings(ctx: AuthContext, data: UpdateCompanySettingsInput) {
    if (!ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: settings.manage required");
    }

    const updated = await prisma.company.update({
      where: { id: ctx.company.id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.website !== undefined ? { website: data.website || null } : {}),
        ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl || null } : {}),
        ...(data.timezone ? { timezone: data.timezone } : {}),
        ...(data.currency ? { currency: data.currency } : {}),
        ...(data.dateFormat ? { dateFormat: data.dateFormat } : {}),
        ...(data.allowSalesPriceOverride !== undefined ? { allowSalesPriceOverride: data.allowSalesPriceOverride } : {}),
        ...(data.customerDirectoryVisibility !== undefined ? { customerDirectoryVisibility: data.customerDirectoryVisibility } : {}),
        ...(data.createEnquiryHistoryEnabled !== undefined ? { createEnquiryHistoryEnabled: data.createEnquiryHistoryEnabled } : {}),
        ...(data.historyPreviewFields !== undefined ? { historyPreviewFields: (data.historyPreviewFields as Prisma.InputJsonValue) ?? Prisma.JsonNull } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        email: true,
        phone: true,
        website: true,
        logoUrl: true,
        timezone: true,
        currency: true,
        dateFormat: true,
        allowSalesPriceOverride: true,
        customerDirectoryVisibility: true,
        createEnquiryHistoryEnabled: true,
        historyPreviewFields: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
        action: "company.settings_updated",
        entityType: "company",
        entityId: ctx.company.id,
        metadata: {
          updatedFields: Object.keys(data),
        },
      },
    });

    return updated;
  }
}
