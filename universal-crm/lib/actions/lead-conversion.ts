"use server";

import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CustomerResolutionService } from "@/lib/services/customer-resolution.service";
import { ValidationError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ActivityType } from "@prisma/client";

export interface ConvertLeadResult {
  success: boolean;
  message?: string;
  data?: {
    customerId: string;
    customerName: string;
    isNewCustomer: boolean;
    leadId: string;
  };
  error?: string;
}

/**
 * Server Action for Lead to Customer Conversion
 *
 * Enforces:
 * 1. Multi-tenant row isolation via AuthContext
 * 2. RBAC check (leads.update + customers.create or Admin)
 * 3. Hierarchical disposition gatekeeping (disposition.allowsConvert)
 * 4. Authoritative E.164 phone resolution and deduplication
 * 5. Automatic status transition to Converted/Won
 * 6. AuditLog and Activity timeline tracking
 */
export async function convertLeadToCustomer(leadId: string): Promise<ConvertLeadResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;

    // Check authorization
    const canConvert =
      authContext.role.name === "Admin" ||
      (authContext.hasPermission("leads", "update") &&
        authContext.hasPermission("customers", "create"));

    if (!canConvert) {
      throw new ForbiddenError(
        "Permission denied: You do not have permission to convert leads to customers"
      );
    }

    // 1. Fetch lead with current disposition and customer reference
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId,
        deletedAt: null,
      },
      include: {
        disposition: true,
        customer: true,
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found or does not belong to your organization");
    }

    // 2. Check if already converted
    if (lead.customerId && lead.customer) {
      return {
        success: true,
        message: "Lead is already converted to a customer",
        data: {
          customerId: lead.customerId,
          customerName: lead.customer.name,
          isNewCustomer: false,
          leadId: lead.id,
        },
      };
    }

    // 3. ENFORCE DISPOSITION GATEKEEPING:
    // If a disposition is assigned, it MUST have allowsConvert = true
    if (lead.disposition && !lead.disposition.allowsConvert) {
      throw new ValidationError(
        `Lead cannot be converted: Current disposition "${lead.disposition.name}" does not permit customer conversion. Please update disposition to an approved conversion outcome first.`
      );
    }

    // 4. Validate phone presence for customer identity resolution
    if (!lead.phone || !lead.phone.trim()) {
      throw new ValidationError(
        "Lead must have a valid phone number to establish a verified customer identity record."
      );
    }

    // 5. Atomic resolution and conversion
    const result = await prisma.$transaction(async (tx) => {
      // Resolve or create Customer using authoritative service
      const resolution = await CustomerResolutionService.resolveCustomer(
        authContext,
        {
          rawPhone: lead.phone,
          name: lead.name,
          email: lead.email,
          companyName: lead.company,
        },
        tx
      );

      const customerId = resolution.customer.id;

      // Find converted status if tenant has one configured
      const convertedStatus = await tx.leadStatus.findFirst({
        where: {
          companyId,
          name: {
            contains: "convert",
          },
        },
      });

      const previousStatusId = lead.statusId;

      // Update lead with customerId and converted status
      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          customerId,
          ...(convertedStatus ? { statusId: convertedStatus.id } : {}),
        },
      });

      // If status changed to converted, record status history
      if (convertedStatus && convertedStatus.id !== previousStatusId) {
        await tx.leadStatusHistory.create({
          data: {
            companyId,
            leadId: lead.id,
            fromStatusId: previousStatusId,
            toStatusId: convertedStatus.id,
            changedById: authContext.user.id,
          },
        });
      }

      // Record Activity on lead timeline
      await tx.activity.create({
        data: {
          companyId,
          leadId: lead.id,
          userId: authContext.user.id,
          type: ActivityType.NOTE,
          description: `Lead converted into Customer "${resolution.customer.name}" by ${authContext.user.name}.`,
          metadata: {
            customerId,
            isNewCustomer: resolution.isNew,
            matchedBy: resolution.matchedBy,
          },
        },
      });

      // Record AuditLog
      await tx.auditLog.create({
        data: {
          companyId,
          userId: authContext.user.id,
          action: "lead.convert_to_customer",
          entityType: "Lead",
          entityId: lead.id,
          metadata: {
            customerId,
            customerName: resolution.customer.name,
            isNew: resolution.isNew,
          },
        },
      });

      return {
        customerId,
        customerName: resolution.customer.name,
        isNewCustomer: resolution.isNew,
        leadId: updatedLead.id,
      };
    });

    return {
      success: true,
      message: "Lead successfully converted to customer",
      data: result,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return {
      success: false,
      error: message,
    };
  }
}
