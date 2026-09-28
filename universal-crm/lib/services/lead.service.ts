/**
 * Lead Management Core Service
 *
 * Implements full tenant isolation, data-scope evaluation, history recording,
 * audit logging, and relationship validation.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import {
  LeadCreateInput,
  LeadUpdateInput,
  LeadListQuery,
  CallOutcomeInput,
  LeadDispositionUpdateInput,
  leadCreateSchema,
  leadUpdateSchema,
  callOutcomeSchema,
  leadDispositionUpdateSchema,
} from "@/lib/validations/lead";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import {
  ActivityType,
  Prisma,
  TaskLifecycleEventType,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { CustomFieldService } from "@/lib/services/custom-field.service";
import { CustomerResolutionService } from "@/lib/services/customer-resolution.service";

export class LeadService {
  /**
   * List leads for the authenticated tenant with filtering, search, and pagination.
   */
  static async listLeads(ctx: AuthContext, query: LeadListQuery) {
    const {
      page,
      limit,
      search,
      statusId,
      sourceId,
      priority,
      assignedUserId,
      teamId,
      customerId,
      offeringId,
      sortBy,
      sortOrder,
    } = query;

    // 1. Enforce data scope for "leads.view"
    const scopeWhere = await getLeadDataScopeWhere(ctx, "view");

    // 2. Build tenant-scoped where clause
    const where: Prisma.LeadWhereInput = {
      companyId: ctx.company.id, // STRICT TENANT ISOLATION
      deletedAt: null,          // EXCLUDE SOFT DELETED
      ...scopeWhere,
    };

    if (statusId) where.statusId = statusId;
    if (sourceId) where.sourceId = sourceId;
    if (priority) where.priority = priority;
    if (assignedUserId) where.assignedUserId = assignedUserId;
    if (teamId) where.teamId = teamId;
    if (customerId) where.customerId = customerId;
    if (offeringId) where.offeringId = offeringId;

    if (search && search.length > 0) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    // 3. Parallel count and findMany execution with exact tuple typing
    const [total, items] = await prisma.$transaction([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          status: {
            select: { id: true, name: true, color: true },
          },
          source: {
            select: { id: true, name: true },
          },
          offering: {
            select: { id: true, name: true, type: true, code: true, defaultPrice: true },
          },
          assignedUser: {
            select: { id: true, name: true, email: true },
          },
          team: {
            select: { id: true, name: true },
          },
          customer: {
            select: { id: true, name: true, displayName: true },
          },
          disposition: {
            select: { id: true, name: true, color: true, isTerminal: true, allowsClose: true },
          },
        },
      }),
    ]);

    return paginatedResponse(items, total, { page, pageSize: limit });
  }

  /**
   * Get single lead by ID with complete relations, history, and timeline.
   */
  static async getLeadById(ctx: AuthContext, id: string) {
    const scopeWhere = await getLeadDataScopeWhere(ctx, "view");

    const lead = await prisma.lead.findFirst({
      where: {
        id,
        companyId: ctx.company.id, // STRICT TENANT ISOLATION
        deletedAt: null,
        ...scopeWhere,
      },
      include: {
        status: true,
        source: true,
        offering: true,
        disposition: {
          select: {
            id: true,
            name: true,
            color: true,
            isTerminal: true,
            allowsClose: true,
            allowsConvert: true,
            requiresFollowUp: true,
            followUpMandatory: true,
            cancelActiveFollowUp: true,
          },
        },
        dispositionUpdatedBy: {
          select: { id: true, name: true, email: true },
        },
        priceUpdatedBy: {
          select: { id: true, name: true, email: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true, phone: true },
        },
        team: {
          select: { id: true, name: true },
        },
        customer: {
          include: {
            phones: true,
            emails: true,
          },
        },
        dispositionHistories: {
          orderBy: { createdAt: "desc" },
          include: {
            fromDisposition: { select: { id: true, name: true, color: true } },
            toDisposition: { select: { id: true, name: true, color: true } },
            changedBy: { select: { id: true, name: true, email: true } },
          },
        },
        statusHistories: {
          orderBy: { changedAt: "desc" },
          include: {
            fromStatus: { select: { id: true, name: true, color: true } },
            toStatus: { select: { id: true, name: true, color: true } },
            changedBy: { select: { id: true, name: true, email: true } },
          },
        },
        assignmentHistories: {
          orderBy: { assignedAt: "desc" },
          include: {
            fromUser: { select: { id: true, name: true, email: true } },
            toUser: { select: { id: true, name: true, email: true } },
            assignedBy: { select: { id: true, name: true, email: true } },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        customFieldValues: {
          include: {
            customField: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    return lead;
  }

  /**
   * Create a new lead for the authenticated tenant.
   */
  static async createLead(ctx: AuthContext, rawInput: LeadCreateInput) {
    if (!ctx.hasPermission("leads", "create")) {
      throw new ForbiddenError("You do not have permission to create leads");
    }

    const input = leadCreateSchema.parse(rawInput);

    // 1. Validate statusId belongs to tenant, or select default status
    let finalStatusId = input.statusId || null;
    if (finalStatusId) {
      const status = await prisma.leadStatus.findFirst({
        where: { id: finalStatusId, companyId: ctx.company.id },
      });
      if (!status) {
        throw new ValidationError("Invalid lead status for this company");
      }
    } else {
      const defaultStatus = await prisma.leadStatus.findFirst({
        where: { companyId: ctx.company.id, isDefault: true },
      });
      finalStatusId = defaultStatus?.id ?? null;
      if (!finalStatusId) {
        const fallbackStatus = await prisma.leadStatus.findFirst({
          where: { companyId: ctx.company.id },
          orderBy: { displayOrder: "asc" },
        });
        finalStatusId = fallbackStatus?.id ?? null;
      }
    }

    // 2. Validate sourceId belongs to tenant
    if (input.sourceId) {
      const source = await prisma.leadSource.findFirst({
        where: { id: input.sourceId, companyId: ctx.company.id },
      });
      if (!source) {
        throw new ValidationError("Invalid lead source for this company");
      }
    }

    // 3. Validate assignedUserId belongs to tenant
    if (input.assignedUserId) {
      const user = await prisma.user.findFirst({
        where: {
          id: input.assignedUserId,
          companyId: ctx.company.id,
          deletedAt: null,
        },
      });
      if (!user) {
        throw new ValidationError("Invalid assigned user for this company");
      }
    }

    // 4. Validate teamId belongs to tenant
    if (input.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: input.teamId, companyId: ctx.company.id },
      });
      if (!team) {
        throw new ValidationError("Invalid team for this company");
      }
    }

    // 5. Validate offering & price override rules (Phase 6)
    let finalOfferingId: string | null = null;
    let defaultPriceAtCreation: Prisma.Decimal | null = null;
    let finalQuotedPrice: Prisma.Decimal | null = null;
    let isPriceOverridden = false;
    let priceOverrideReason: string | null = null;
    let priceUpdatedById: string | null = null;
    let priceUpdatedAt: Date | null = null;

    if (input.offeringId && input.offeringId.trim()) {
      const offering = await prisma.offering.findFirst({
        where: {
          id: input.offeringId.trim(),
          companyId: ctx.company.id,
          deletedAt: null,
        },
      });

      if (!offering) {
        throw new ValidationError("Invalid offering for this company");
      }

      if (!offering.isActive) {
        throw new ValidationError("Cannot create enquiry for an inactive product or service offering");
      }

      finalOfferingId = offering.id;
      defaultPriceAtCreation = offering.defaultPrice;

      const basePriceNum = Number(offering.defaultPrice);
      const quotedPriceNum =
        input.quotedPrice !== null && input.quotedPrice !== undefined
          ? input.quotedPrice
          : input.amount !== null && input.amount !== undefined
          ? input.amount
          : basePriceNum;

      // Check if price was altered from default
      if (Math.abs(quotedPriceNum - basePriceNum) > 0.001) {
        const tenantAllowOverride = ctx.company.allowSalesPriceOverride !== false;
        const offeringAllowOverride = offering.allowSalesPriceOverride !== false;
        const canBypassOverride =
          ctx.hasPermission("offerings", "manage") ||
          ctx.role.name === "Admin";

        if (!canBypassOverride && (!tenantAllowOverride || !offeringAllowOverride)) {
          throw new ForbiddenError(
            "Price override is not permitted for this offering or organization (Tenant policy disallows override or offering price is locked)"
          );
        }

        isPriceOverridden = true;
        finalQuotedPrice = new Prisma.Decimal(quotedPriceNum);
        priceOverrideReason = input.priceOverrideReason?.trim() || null;
        priceUpdatedById = ctx.user.id;
        priceUpdatedAt = new Date();
      } else {
        finalQuotedPrice = offering.defaultPrice;
      }
    } else if (input.amount !== null && input.amount !== undefined) {
      finalQuotedPrice = new Prisma.Decimal(input.amount);
    }

    const finalAmount =
      finalQuotedPrice ??
      (input.amount !== null && input.amount !== undefined
        ? new Prisma.Decimal(input.amount)
        : null);

    // 6. Execute creation within atomic transaction
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Resolve or create customer inside this exact transaction (ensures atomic rollback on failure)
      let finalCustomerId: string | null = input.customerId || null;

      if (input.customerId) {
        const resolution = await CustomerResolutionService.resolveCustomer(
          ctx,
          {
            customerId: input.customerId,
            rawPhone: input.phone || undefined,
            name: input.name,
            email: input.email,
            companyName: input.company,
          },
          tx
        );
        finalCustomerId = resolution.customer.id;
      } else if (input.phone && input.phone.trim()) {
        const resolution = await CustomerResolutionService.resolveCustomer(
          ctx,
          {
            rawPhone: input.phone,
            name: input.name,
            email: input.email,
            companyName: input.company,
          },
          tx
        );
        finalCustomerId = resolution.customer.id;
      }

      const lead = await tx.lead.create({
        data: {
          companyId: ctx.company.id, // Strictly derived from AuthContext
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          company: input.company || null,
          amount: finalAmount,
          priority: input.priority,
          sourceId: input.sourceId || null,
          statusId: finalStatusId,
          assignedUserId: input.assignedUserId || null,
          teamId: input.teamId || null,
          customerId: finalCustomerId,
          offeringId: finalOfferingId,
          defaultPriceAtCreation,
          quotedPrice: finalQuotedPrice,
          priceOverridden: isPriceOverridden,
          priceOverrideReason,
          priceUpdatedById,
          priceUpdatedAt,
        },
        include: {
          status: true,
          source: true,
          offering: true,
          assignedUser: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, displayName: true } },
        },
      });

      // Record initial status history
      if (finalStatusId) {
        await tx.leadStatusHistory.create({
          data: {
            companyId: ctx.company.id,
            leadId: lead.id,
            fromStatusId: null,
            toStatusId: finalStatusId,
            changedById: ctx.user.id,
          },
        });
      }

      // Record initial assignment history if assigned
      if (input.assignedUserId) {
        await tx.leadAssignmentHistory.create({
          data: {
            companyId: ctx.company.id,
            leadId: lead.id,
            fromUserId: null,
            toUserId: input.assignedUserId,
            assignedById: ctx.user.id,
          },
        });
      }

      // Record timeline activity
      await tx.activity.create({
        data: {
          companyId: ctx.company.id,
          leadId: lead.id,
          userId: ctx.user.id,
          type: ActivityType.LEAD_CREATED,
          description: `Lead "${lead.name}" created by ${ctx.user.name}`,
          metadata: {
            name: lead.name,
            email: lead.email,
            status: lead.status?.name,
            creator: ctx.user.name,
          },
        },
      });

      // Save custom fields if provided
      if (input.customFields) {
        await CustomFieldService.saveLeadCustomFields(
          tx,
          ctx,
          lead.id,
          input.customFields as Record<string, unknown>,
          { skipScopeCheck: true }
        );
      }

      // Audit log entry for lead creation
      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "lead.create",
          entityType: "lead",
          entityId: lead.id,
          metadata: { name: lead.name },
        },
      });

      // Audit log entry for price override if applicable
      if (isPriceOverridden) {
        await tx.auditLog.create({
          data: {
            companyId: ctx.company.id,
            userId: ctx.user.id,
            action: "lead.price_overridden",
            entityType: "lead",
            entityId: lead.id,
            metadata: {
              offeringId: finalOfferingId,
              defaultPrice: defaultPriceAtCreation?.toString(),
              quotedPrice: finalQuotedPrice?.toString(),
              reason: priceOverrideReason,
            },
          },
        });
      }

      return lead;
    });
  }

  /**
   * Update lead details, status transitions, or assignments.
   */
  static async updateLead(ctx: AuthContext, id: string, rawInput: LeadUpdateInput) {
    if (!ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("You do not have permission to update leads");
    }

    const input = leadUpdateSchema.parse(rawInput);

    const scopeWhere = await getLeadDataScopeWhere(ctx, "update");

    // 1. Fetch existing lead
    const existing = await prisma.lead.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
        ...scopeWhere,
      },
    });

    if (!existing) {
      throw new NotFoundError("Lead not found");
    }

    // 2. Validate foreign keys if updated
    if (input.sourceId !== undefined && input.sourceId !== null && input.sourceId !== "") {
      const source = await prisma.leadSource.findFirst({
        where: { id: input.sourceId, companyId: ctx.company.id },
      });
      if (!source) throw new ValidationError("Invalid lead source for this company");
    }

    if (input.statusId !== undefined && input.statusId !== null && input.statusId !== "") {
      const status = await prisma.leadStatus.findFirst({
        where: { id: input.statusId, companyId: ctx.company.id },
      });
      if (!status) throw new ValidationError("Invalid lead status for this company");
    }

    if (input.assignedUserId !== undefined && input.assignedUserId !== null && input.assignedUserId !== "") {
      if (!ctx.hasPermission("leads", "assign")) {
        throw new ForbiddenError("You do not have permission to reassign leads");
      }
      const user = await prisma.user.findFirst({
        where: { id: input.assignedUserId, companyId: ctx.company.id, deletedAt: null },
      });
      if (!user) throw new ValidationError("Invalid assigned user for this company");
    }

    if (input.teamId !== undefined && input.teamId !== null && input.teamId !== "") {
      const team = await prisma.team.findFirst({
        where: { id: input.teamId, companyId: ctx.company.id },
      });
      if (!team) throw new ValidationError("Invalid team for this company");
    }

    if (input.customerId !== undefined && input.customerId !== null && input.customerId !== "") {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, companyId: ctx.company.id, deletedAt: null },
      });
      if (!customer) throw new ValidationError("Invalid customer for this company");
    }

    // Customer link / unlink / reassign authorization check (Correction 2)
    const customerChanged =
      input.customerId !== undefined && (input.customerId || null) !== existing.customerId;

    if (customerChanged) {
      if (!ctx.hasPermission("customers", "manage") && !ctx.hasPermission("customers", "link")) {
        throw new ForbiddenError(
          "You do not have permission to link, unlink, or reassign customer identity for an enquiry"
        );
      }
    }

    // 3. Detect changes
    const statusChanged = input.statusId !== undefined && input.statusId !== existing.statusId;
    const assignmentChanged =
      input.assignedUserId !== undefined && input.assignedUserId !== existing.assignedUserId;

    // Check if status is transitioning to a closed state and current disposition forbids closing
    if (statusChanged && input.statusId && existing.dispositionId) {
      const targetStatus = await prisma.leadStatus.findFirst({
        where: { id: input.statusId, companyId: ctx.company.id },
      });
      const isClosedStatus = targetStatus && /^(closed|won|lost|deal|converted)/i.test(targetStatus.name);
      if (isClosedStatus) {
        const currentDisp = await prisma.disposition.findFirst({
          where: { id: existing.dispositionId, companyId: ctx.company.id },
        });
        if (currentDisp && !currentDisp.allowsClose) {
          throw new ValidationError(
            `Cannot close lead: Current disposition "${currentDisp.name}" does not allow closing.`
          );
        }
      }
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Build update payload (mass assignment prevention: never touch companyId, id, deletedAt)
      const dataToUpdate: Prisma.LeadUpdateInput = {};

      if (input.name !== undefined) dataToUpdate.name = input.name;
      if (input.email !== undefined) dataToUpdate.email = input.email || null;
      if (input.phone !== undefined) dataToUpdate.phone = input.phone || null;
      if (input.company !== undefined) dataToUpdate.company = input.company || null;
      if (input.amount !== undefined) dataToUpdate.amount = input.amount !== null ? input.amount : null;
      if (input.priority !== undefined) dataToUpdate.priority = input.priority;
      if (input.sourceId !== undefined) {
        dataToUpdate.source = input.sourceId ? { connect: { id: input.sourceId } } : { disconnect: true };
      }
      if (input.statusId !== undefined) {
        dataToUpdate.status = input.statusId ? { connect: { id: input.statusId } } : { disconnect: true };
      }
      if (input.assignedUserId !== undefined) {
        dataToUpdate.assignedUser = input.assignedUserId
          ? { connect: { id: input.assignedUserId } }
          : { disconnect: true };
      }
      if (input.teamId !== undefined) {
        dataToUpdate.team = input.teamId ? { connect: { id: input.teamId } } : { disconnect: true };
      }
      if (input.customerId !== undefined) {
        dataToUpdate.customer = input.customerId ? { connect: { id: input.customerId } } : { disconnect: true };
      }

      if (input.offeringId !== undefined) {
        if (input.offeringId && input.offeringId.trim()) {
          const offering = await prisma.offering.findFirst({
            where: {
              id: input.offeringId.trim(),
              companyId: ctx.company.id,
              deletedAt: null,
            },
          });
          if (!offering) throw new ValidationError("Invalid offering for this company");
          if (!offering.isActive) throw new ValidationError("Cannot select an inactive offering");

          dataToUpdate.offering = { connect: { id: offering.id } };
          dataToUpdate.defaultPriceAtCreation = offering.defaultPrice;

          const basePriceNum = Number(offering.defaultPrice);
          const quotedPriceNum =
            input.quotedPrice !== null && input.quotedPrice !== undefined
              ? input.quotedPrice
              : basePriceNum;

          if (Math.abs(quotedPriceNum - basePriceNum) > 0.001) {
            const tenantAllowOverride = ctx.company.allowSalesPriceOverride !== false;
            const offeringAllowOverride = offering.allowSalesPriceOverride !== false;
            const canBypassOverride =
              ctx.hasPermission("offerings", "manage") || ctx.role.name === "Admin";

            if (!canBypassOverride && (!tenantAllowOverride || !offeringAllowOverride)) {
              throw new ForbiddenError(
                "Price override is not permitted for this offering or organization (Tenant policy disallows override or offering price is locked)"
              );
            }

            dataToUpdate.priceOverridden = true;
            dataToUpdate.quotedPrice = new Prisma.Decimal(quotedPriceNum);
            dataToUpdate.amount = new Prisma.Decimal(quotedPriceNum);
            dataToUpdate.priceOverrideReason = input.priceOverrideReason?.trim() || null;
            dataToUpdate.priceUpdatedBy = { connect: { id: ctx.user.id } };
            dataToUpdate.priceUpdatedAt = new Date();
          } else {
            dataToUpdate.quotedPrice = offering.defaultPrice;
            dataToUpdate.amount = offering.defaultPrice;
            dataToUpdate.priceOverridden = false;
          }
        } else {
          dataToUpdate.offering = { disconnect: true };
        }
      } else if (input.quotedPrice !== undefined && existing.offeringId) {
        const offering = await prisma.offering.findUnique({ where: { id: existing.offeringId } });
        if (offering) {
          const basePriceNum = Number(existing.defaultPriceAtCreation ?? offering.defaultPrice);
          const quotedPriceNum = input.quotedPrice !== null ? input.quotedPrice : basePriceNum;
          if (Math.abs(quotedPriceNum - basePriceNum) > 0.001) {
            const tenantAllowOverride = ctx.company.allowSalesPriceOverride !== false;
            const offeringAllowOverride = offering.allowSalesPriceOverride !== false;
            const canBypassOverride =
              ctx.hasPermission("offerings", "manage") || ctx.role.name === "Admin";

            if (!canBypassOverride && (!tenantAllowOverride || !offeringAllowOverride)) {
              throw new ForbiddenError(
                "Price override is not permitted for this offering or organization (Tenant policy disallows override or offering price is locked)"
              );
            }

            dataToUpdate.priceOverridden = true;
            dataToUpdate.quotedPrice = new Prisma.Decimal(quotedPriceNum);
            dataToUpdate.amount = new Prisma.Decimal(quotedPriceNum);
            dataToUpdate.priceOverrideReason = input.priceOverrideReason?.trim() || null;
            dataToUpdate.priceUpdatedBy = { connect: { id: ctx.user.id } };
            dataToUpdate.priceUpdatedAt = new Date();
          } else {
            dataToUpdate.quotedPrice = new Prisma.Decimal(basePriceNum);
            dataToUpdate.amount = new Prisma.Decimal(basePriceNum);
            dataToUpdate.priceOverridden = false;
          }
        }
      }

      const updatedLead = await tx.lead.update({
        where: { id },
        data: dataToUpdate,
        include: {
          status: true,
          source: true,
          offering: true,
          assignedUser: { select: { id: true, name: true, email: true } },
          team: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, displayName: true } },
        },
      });

      // Handle Status Change History
      if (statusChanged && input.statusId) {
        await tx.leadStatusHistory.create({
          data: {
            companyId: ctx.company.id,
            leadId: id,
            fromStatusId: existing.statusId,
            toStatusId: input.statusId,
            changedById: ctx.user.id,
          },
        });

        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: id,
            userId: ctx.user.id,
            type: ActivityType.STATUS_CHANGED,
            description: `Status changed to "${updatedLead.status?.name ?? "Updated"}" by ${ctx.user.name}`,
            metadata: {
              oldStatusId: existing.statusId,
              newStatusId: input.statusId,
              newStatusName: updatedLead.status?.name,
            },
          },
        });
      }

      // Handle Assignment History
      if (assignmentChanged) {
        await tx.leadAssignmentHistory.create({
          data: {
            companyId: ctx.company.id,
            leadId: id,
            fromUserId: existing.assignedUserId,
            toUserId: input.assignedUserId || null,
            assignedById: ctx.user.id,
          },
        });

        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: id,
            userId: ctx.user.id,
            type: existing.assignedUserId ? ActivityType.REASSIGNED : ActivityType.ASSIGNED,
            description: `Assigned to ${updatedLead.assignedUser?.name ?? "Unassigned"} by ${ctx.user.name}`,
            metadata: {
              previousAssignee: existing.assignedUserId,
              newAssignee: input.assignedUserId || null,
              newAssigneeName: updatedLead.assignedUser?.name ?? "Unassigned",
            },
          },
        });
      }

      // Record customer link/unlink activity & audit log
      if (customerChanged) {
        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: id,
            userId: ctx.user.id,
            type: ActivityType.LEAD_UPDATED,
            description: input.customerId
              ? `Enquiry linked to customer identity (${input.customerId}) by ${ctx.user.name}`
              : `Enquiry unlinked from customer identity by ${ctx.user.name}`,
            metadata: {
              previousCustomerId: existing.customerId,
              newCustomerId: input.customerId || null,
            },
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: ctx.company.id,
            userId: ctx.user.id,
            action: input.customerId ? "customer.link_enquiry" : "customer.unlink_enquiry",
            entityType: "lead",
            entityId: id,
            metadata: {
              previousCustomerId: existing.customerId,
              newCustomerId: input.customerId || null,
            },
          },
        });
      }

      if (!statusChanged && !assignmentChanged && !customerChanged) {
        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: id,
            userId: ctx.user.id,
            type: ActivityType.LEAD_UPDATED,
            description: `Lead updated by ${ctx.user.name}`,
            metadata: { updatedBy: ctx.user.name },
          },
        });
      }

      // Save custom fields if updated
      if (input.customFields !== undefined && input.customFields !== null) {
        await CustomFieldService.saveLeadCustomFields(
          tx,
          ctx,
          id,
          input.customFields as Record<string, unknown>
        );
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "lead.update",
          entityType: "lead",
          entityId: id,
          metadata: { changes: Object.keys(dataToUpdate) },
        },
      });

      return updatedLead;
    });
  }

  /**
   * Soft delete a lead.
   */
  static async deleteLead(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("leads", "delete")) {
      throw new ForbiddenError("You do not have permission to delete leads");
    }

    const scopeWhere = await getLeadDataScopeWhere(ctx, "delete");

    const existing = await prisma.lead.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
        deletedAt: null,
        ...scopeWhere,
      },
    });

    if (!existing) {
      throw new NotFoundError("Lead not found");
    }

    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      prisma.activity.create({
        data: {
          companyId: ctx.company.id,
          leadId: id,
          userId: ctx.user.id,
          type: ActivityType.LEAD_DELETED,
          description: `Lead "${existing.name}" deleted by ${ctx.user.name}`,
          metadata: { name: existing.name, deletedBy: ctx.user.name },
        },
      }),
      prisma.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "lead.delete",
          entityType: "lead",
          entityId: id,
          metadata: { name: existing.name },
        },
      }),
    ]);

    return { success: true, message: "Lead deleted successfully" };
  }

  /**
   * Get tenant-scoped lead configuration (statuses, sources, users, teams) for form dropdowns.
   */
  static async getLeadConfig(ctx: AuthContext) {
    const [statuses, sources, users, teams, offerings, dispositions] = await Promise.all([
      prisma.leadStatus.findMany({
        where: { companyId: ctx.company.id },
        orderBy: { displayOrder: "asc" },
        select: { id: true, name: true, color: true, isDefault: true },
      }),
      prisma.leadSource.findMany({
        where: { companyId: ctx.company.id, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { companyId: ctx.company.id, deletedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      }),
      prisma.team.findMany({
        where: { companyId: ctx.company.id, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.offering.findMany({
        where: { companyId: ctx.company.id, isActive: true, deletedAt: null },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          type: true,
          code: true,
          defaultPrice: true,
          currency: true,
          allowSalesPriceOverride: true,
        },
      }),
      prisma.disposition.findMany({
        where: { companyId: ctx.company.id, isActive: true, deletedAt: null },
        orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          parentId: true,
          depth: true,
          color: true,
          isTerminal: true,
          requiresFollowUp: true,
          followUpMandatory: true,
          allowsClose: true,
          allowsConvert: true,
          cancelActiveFollowUp: true,
        },
      }),
    ]);

    return {
      statuses,
      sources,
      users,
      teams,
      offerings,
      dispositions,
      tenantAllowSalesPriceOverride: ctx.company.allowSalesPriceOverride ?? true,
    };
  }

  /**
   * Atomic Call Outcome Logging Engine — Phase 7
   *
   * Atomically executes in a single transaction:
   * 1. Validate disposition & enforce generic rules
   * 2. Log CALL activity on lead timeline
   * 3. Update lead disposition & append LeadDispositionHistory
   * 4. Follow-up handling:
   *    - If cancelActiveFollowUp: cancels all active follow-ups for lead
   *    - If dueAt provided: reschedules existing active follow-up OR creates new one
   * 5. Record AuditLog
   */
  static async recordCallOutcome(
    ctx: AuthContext,
    leadId: string,
    rawInput: CallOutcomeInput
  ) {
    const canRecord =
      ctx.hasPermission("leads", "update") ||
      ctx.hasPermission("activities", "create") ||
      ctx.role.name === "Admin";

    if (!canRecord) {
      throw new ForbiddenError("Permission denied: Cannot record call outcome");
    }

    const parsed = callOutcomeSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || "Validation failed");
    }
    const input = parsed.data;
    const scopeWhere = await getLeadDataScopeWhere(ctx, "update");

    // 1. Fetch lead with tenant isolation and data scope
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId: ctx.company.id,
        deletedAt: null,
        ...scopeWhere,
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    // 2. Validate disposition exists in tenant and is active
    const disposition = await prisma.disposition.findFirst({
      where: {
        id: input.dispositionId,
        companyId: ctx.company.id,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!disposition) {
      throw new ValidationError("Invalid disposition or disposition does not belong to this company");
    }

    // 3. Enforce disposition rules
    if (disposition.followUpMandatory && !input.dueAt) {
      throw new ValidationError(
        `Disposition "${disposition.name}" mandates a scheduled follow-up date and time.`
      );
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date();

      // 4. Log CALL activity on lead timeline
      await tx.activity.create({
        data: {
          companyId: ctx.company.id,
          leadId: lead.id,
          userId: ctx.user.id,
          type: ActivityType.CALL,
          description: `Call logged: ${disposition.name}${input.notes ? ` — ${input.notes}` : ""}`,
          metadata: {
            dispositionId: disposition.id,
            dispositionName: disposition.name,
            durationSeconds: input.durationSeconds ?? null,
            notes: input.notes ?? null,
            dueAt: input.dueAt ?? null,
          },
        },
      });

      // 5. Update lead disposition if changed
      let dispositionChanged = false;
      if (lead.dispositionId !== disposition.id) {
        dispositionChanged = true;

        await tx.leadDispositionHistory.create({
          data: {
            companyId: ctx.company.id,
            leadId: lead.id,
            fromDispositionId: lead.dispositionId,
            toDispositionId: disposition.id,
            changedById: ctx.user.id,
            notes: input.notes ?? null,
          },
        });

        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: lead.id,
            userId: ctx.user.id,
            type: ActivityType.DISPOSITION_CHANGED,
            description: `Disposition updated to "${disposition.name}" by ${ctx.user.name}`,
            metadata: {
              fromDispositionId: lead.dispositionId,
              toDispositionId: disposition.id,
              toDispositionName: disposition.name,
            },
          },
        });

        await tx.lead.update({
          where: { id: lead.id },
          data: {
            dispositionId: disposition.id,
            dispositionUpdatedAt: now,
            dispositionUpdatedById: ctx.user.id,
          },
        });
      }

      // 6. Follow-up Task Handling
      if (disposition.cancelActiveFollowUp) {
        // Cancel all active follow-up tasks for this lead
        const activeTasks = await tx.task.findMany({
          where: {
            companyId: ctx.company.id,
            leadId: lead.id,
            type: TaskType.FOLLOW_UP,
            status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
          },
        });

        for (const task of activeTasks) {
          await tx.task.update({
            where: { id: task.id },
            data: {
              status: TaskStatus.CANCELLED,
              cancelledAt: now,
            },
          });

          await tx.taskRescheduleHistory.create({
            data: {
              taskId: task.id,
              companyId: ctx.company.id,
              leadId: lead.id,
              performedById: ctx.user.id,
              eventType: TaskLifecycleEventType.CANCELLED,
              previousDueAt: task.dueAt,
              newDueAt: task.dueAt,
              reason: `Cancelled by disposition rule: "${disposition.name}"`,
              dispositionId: disposition.id,
            },
          });

          await tx.activity.create({
            data: {
              companyId: ctx.company.id,
              leadId: lead.id,
              userId: ctx.user.id,
              type: ActivityType.TASK_CANCELLED,
              description: `Follow-up "${task.title}" cancelled by disposition: "${disposition.name}"`,
              metadata: {
                taskId: task.id,
                dispositionId: disposition.id,
              },
            },
          });
        }
      } else if (input.dueAt) {
        // Look for existing active follow-up
        const existingFollowUp = await tx.task.findFirst({
          where: {
            companyId: ctx.company.id,
            leadId: lead.id,
            type: TaskType.FOLLOW_UP,
            status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
          },
        });

        if (existingFollowUp) {
          // Reschedule existing follow-up (never create duplicate)
          await tx.task.update({
            where: { id: existingFollowUp.id },
            data: {
              dueAt: input.dueAt,
              status: TaskStatus.PENDING,
              assignedUserId: input.assignedUserId || existingFollowUp.assignedUserId || ctx.user.id,
              completedAt: null,
              completedById: null,
              cancelledAt: null,
            },
          });

          await tx.taskRescheduleHistory.create({
            data: {
              taskId: existingFollowUp.id,
              companyId: ctx.company.id,
              leadId: lead.id,
              performedById: ctx.user.id,
              eventType: TaskLifecycleEventType.RESCHEDULED,
              previousDueAt: existingFollowUp.dueAt,
              newDueAt: input.dueAt,
              reason: input.followUpReason || input.notes || `Rescheduled via outcome: ${disposition.name}`,
              dispositionId: disposition.id,
            },
          });

          await tx.activity.create({
            data: {
              companyId: ctx.company.id,
              leadId: lead.id,
              userId: ctx.user.id,
              type: ActivityType.TASK_RESCHEDULED,
              description: `Follow-up "${existingFollowUp.title}" rescheduled to ${new Date(
                input.dueAt
              ).toLocaleString()} by ${ctx.user.name}`,
              metadata: {
                taskId: existingFollowUp.id,
                previousDueAt: existingFollowUp.dueAt,
                newDueAt: input.dueAt,
                dispositionId: disposition.id,
              },
            },
          });
        } else {
          // Create new follow-up (ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK)
          const newTask = await tx.task.create({
            data: {
              companyId: ctx.company.id,
              type: TaskType.FOLLOW_UP,
              leadId: lead.id,
              title: `Follow-up: ${lead.name}`,
              description:
                input.followUpReason || input.notes || `Follow-up following disposition: ${disposition.name}`,
              dueAt: input.dueAt,
              status: TaskStatus.PENDING,
              assignedUserId: input.assignedUserId || lead.assignedUserId || ctx.user.id,
              createdById: ctx.user.id,
            },
          });

          await tx.taskRescheduleHistory.create({
            data: {
              taskId: newTask.id,
              companyId: ctx.company.id,
              leadId: lead.id,
              performedById: ctx.user.id,
              eventType: TaskLifecycleEventType.CREATED,
              previousDueAt: null,
              newDueAt: input.dueAt,
              reason: input.followUpReason || input.notes || `Initial follow-up scheduled for: ${disposition.name}`,
              dispositionId: disposition.id,
            },
          });

          await tx.activity.create({
            data: {
              companyId: ctx.company.id,
              leadId: lead.id,
              userId: ctx.user.id,
              type: ActivityType.TASK_CREATED,
              description: `Follow-up scheduled for ${new Date(input.dueAt).toLocaleString()} by ${
                ctx.user.name
              }`,
              metadata: {
                taskId: newTask.id,
                dueAt: input.dueAt,
                dispositionId: disposition.id,
              },
            },
          });
        }
      }

      // 7. Audit log entry
      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "lead.call_outcome",
          entityType: "Lead",
          entityId: lead.id,
          metadata: {
            dispositionId: disposition.id,
            dispositionName: disposition.name,
            dispositionChanged,
            durationSeconds: input.durationSeconds ?? null,
            dueAt: input.dueAt ?? null,
            followUpReason: input.followUpReason ?? null,
          },
        },
      });

      return {
        success: true,
        leadId: lead.id,
        disposition,
      };
    });
  }

  /**
   * Get disposition transition history for a lead.
   */
  static async getLeadDispositionHistory(ctx: AuthContext, leadId: string) {
    const scopeWhere = await getLeadDataScopeWhere(ctx, "view");

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId: ctx.company.id,
        deletedAt: null,
        ...scopeWhere,
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    return prisma.leadDispositionHistory.findMany({
      where: {
        leadId,
        companyId: ctx.company.id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        fromDisposition: { select: { id: true, name: true, color: true } },
        toDisposition: { select: { id: true, name: true, color: true } },
        changedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Directly update disposition for a lead without logging a call activity.
   */
  static async updateLeadDisposition(
    ctx: AuthContext,
    leadId: string,
    rawInput: LeadDispositionUpdateInput
  ) {
    if (!ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("Permission denied: Cannot update lead disposition");
    }

    const parsed = leadDispositionUpdateSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || "Validation failed");
    }
    const input = parsed.data;
    const scopeWhere = await getLeadDataScopeWhere(ctx, "update");

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId: ctx.company.id,
        deletedAt: null,
        ...scopeWhere,
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead not found");
    }

    const disposition = await prisma.disposition.findFirst({
      where: {
        id: input.dispositionId,
        companyId: ctx.company.id,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!disposition) {
      throw new ValidationError("Invalid disposition for this company");
    }

    if (lead.dispositionId === disposition.id) {
      return lead;
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date();

      await tx.leadDispositionHistory.create({
        data: {
          companyId: ctx.company.id,
          leadId: lead.id,
          fromDispositionId: lead.dispositionId,
          toDispositionId: disposition.id,
          changedById: ctx.user.id,
          notes: input.notes ?? null,
        },
      });

      await tx.activity.create({
        data: {
          companyId: ctx.company.id,
          leadId: lead.id,
          userId: ctx.user.id,
          type: ActivityType.DISPOSITION_CHANGED,
          description: `Disposition updated to "${disposition.name}" by ${ctx.user.name}`,
          metadata: {
            fromDispositionId: lead.dispositionId,
            toDispositionId: disposition.id,
            toDispositionName: disposition.name,
          },
        },
      });

      const updated = await tx.lead.update({
        where: { id: lead.id },
        data: {
          dispositionId: disposition.id,
          dispositionUpdatedAt: now,
          dispositionUpdatedById: ctx.user.id,
        },
        include: {
          disposition: true,
          status: true,
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "lead.disposition_update",
          entityType: "Lead",
          entityId: lead.id,
          metadata: {
            fromDispositionId: lead.dispositionId,
            toDispositionId: disposition.id,
          },
        },
      });

      return updated;
    });
  }
}

