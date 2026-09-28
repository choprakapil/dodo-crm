/**
 * Customer Service (Universal CRM)
 * 
 * Central business logic for customer lifecycle, identity, contact points,
 * tenant isolation, RBAC, and Data-Scope-filtered enquiry history.
 * 
 * Rules:
 * 1. ONE CUSTOMER != ONE ENQUIRY (One Customer has Many Enquiries).
 * 2. Strict tenant isolation: companyId is always extracted from AuthContext.
 * 3. Enforces RBAC permissions:
 *    - customers.view
 *    - customers.create
 *    - customers.update
 *    - customers.delete
 *    - customers.manage
 * 4. Customer profile enforces enquiry Data Scope (OWN, TEAM, COMPANY).
 *    Customer access NEVER bypasses enquiry authorization.
 * 5. Soft delete preserves all historical enquiries, activities, notes, and tasks.
 * 6. Contact point deduplication and primary phone/email state invariant guarantees.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import { PhoneNormalizer } from "@/lib/utils/phone";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "@/lib/errors";
import {
  CustomerQueryInput,
  CustomerCreateInput,
  CustomerUpdateInput,
  CustomerAddPhoneInput,
  CustomerUpdatePhoneInput,
  CustomerAddEmailInput,
  CustomerUpdateEmailInput,
} from "@/lib/validations/customer";
import { Prisma } from "@prisma/client";

export class CustomerService {
  /**
   * List customers with pagination, search, and contact hydration
   */
  static async listCustomers(ctx: AuthContext, query: CustomerQueryInput = {}) {
    if (!ctx.hasPermission("customers", "view")) {
      throw new ForbiddenError("Permission denied: customers.view required");
    }

    const companyId = ctx.company.id;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;
    const search = query.search;
    const phone = query.phone;
    const email = query.email;
    const sortBy = (query.sortBy as "name" | "createdAt" | "updatedAt") || "createdAt";
    const sortOrder = (query.sortOrder as "asc" | "desc") || "desc";
    const includeDeleted = Boolean(query.includeDeleted);
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      companyId,
      deletedAt: includeDeleted && ctx.hasPermission("customers", "manage") ? undefined : null,
    };

    // Customer Directory Visibility & Data Scope Enforcement (Phase 6)
    const companyVisibility = ctx.company.customerDirectoryVisibility || "DATA_SCOPE";
    const leadScope = ctx.getDataScope("leads", "view");
    const custScope = ctx.getDataScope("customers", "view");

    const isRestricted =
      companyVisibility === "DATA_SCOPE" ||
      leadScope === "OWN" ||
      leadScope === "TEAM" ||
      custScope === "OWN" ||
      custScope === "TEAM";

    if (isRestricted && !ctx.hasPermission("customers", "manage") && ctx.role.name !== "Admin") {
      const leadScopeWhere = await getLeadDataScopeWhere(ctx, "view");
      where.enquiries = {
        some: {
          ...leadScopeWhere,
          deletedAt: null,
        },
      };
    }

    if (phone && phone.trim()) {
      const digitsOnly = phone.trim().replace(/\D/g, "");
      where.phones = {
        some: {
          OR: [
            ...(digitsOnly.length >= 3 ? [{ normalizedPhone: { contains: digitsOnly } }] : []),
            { rawPhone: { contains: phone.trim(), mode: "insensitive" as const } },
          ],
        },
      };
    }

    if (email && email.trim()) {
      where.emails = {
        some: {
          email: { contains: email.trim().toLowerCase(), mode: "insensitive" as const },
        },
      };
    }

    if (search && search.trim()) {
      const term = search.trim();
      // Test if search might be a phone number
      const digitsOnly = term.replace(/\D/g, "");
      const phoneFilters: Prisma.CustomerPhoneListRelationFilter[] = [];

      if (digitsOnly.length >= 3) {
        phoneFilters.push({
          some: {
            OR: [
              { normalizedPhone: { contains: digitsOnly } },
              { rawPhone: { contains: term, mode: "insensitive" } },
            ],
          },
        });
      }

      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { displayName: { contains: term, mode: "insensitive" } },
        { companyName: { contains: term, mode: "insensitive" } },
        { emails: { some: { email: { contains: term.toLowerCase(), mode: "insensitive" } } } },
        ...phoneFilters.map((pf) => ({ phones: pf })),
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          companyId: true,
          name: true,
          displayName: true,
          companyName: true,
          notes: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          phones: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 3,
            select: {
              id: true,
              rawPhone: true,
              normalizedPhone: true,
              type: true,
              isPrimary: true,
            },
          },
          emails: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 3,
            select: {
              id: true,
              email: true,
              type: true,
              isPrimary: true,
            },
          },
          _count: {
            select: {
              enquiries: {
                where: { deletedAt: null },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single customer with contact points and DATA-SCOPE-FILTERED enquiries
   */
  static async getCustomerById(
    ctx: AuthContext,
    id: string,
    options: {
      enquiryPage?: number;
      enquiryLimit?: number;
      includeDeleted?: boolean;
    } | number = 1,
    legacyEnquiryLimit = 10
  ) {
    if (!ctx.hasPermission("customers", "view")) {
      throw new ForbiddenError("Permission denied: customers.view required");
    }

    const companyId = ctx.company.id;
    let enquiryPage = 1;
    let enquiryLimit = 10;
    let includeDeleted = false;

    if (typeof options === "object") {
      enquiryPage = options.enquiryPage ?? 1;
      enquiryLimit = options.enquiryLimit ?? 10;
      includeDeleted = options.includeDeleted ?? false;
    } else if (typeof options === "number") {
      enquiryPage = options;
      enquiryLimit = legacyEnquiryLimit;
    }

    if (includeDeleted && !ctx.hasPermission("customers", "manage")) {
      throw new ForbiddenError("Permission denied: customers.manage required to view deleted customer");
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id,
        companyId,
        deletedAt: includeDeleted ? undefined : null,
      },
      include: {
        phones: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        emails: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    // =========================================================================
    // CRITICAL REQUIREMENT: Data Scope Enforcement on Customer Enquiries
    // Customer profile must NEVER bypass enquiry Data Scope (OWN, TEAM, COMPANY).
    // =========================================================================
    const leadScopeWhere = await getLeadDataScopeWhere(ctx, "view");
    const enquiryWhere: Prisma.LeadWhereInput = {
      customerId: id,
      companyId,
      deletedAt: null,
      ...leadScopeWhere,
    };

    const enquirySkip = (enquiryPage - 1) * enquiryLimit;

    const [enquiryTotal, authorizedEnquiries] = await Promise.all([
      prisma.lead.count({ where: enquiryWhere }),
      prisma.lead.findMany({
        where: enquiryWhere,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          company: true,
          priority: true,
          amount: true,
          createdAt: true,
          updatedAt: true,
          status: {
            select: { id: true, name: true, color: true },
          },
          source: {
            select: { id: true, name: true },
          },
          assignedUser: {
            select: { id: true, name: true, email: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: enquirySkip,
        take: enquiryLimit,
      }),
    ]);

    return {
      customer,
      enquiries: authorizedEnquiries,
      enquiryPagination: {
        page: enquiryPage,
        limit: enquiryLimit,
        total: enquiryTotal,
        totalPages: Math.ceil(enquiryTotal / enquiryLimit) || 1,
      },
      enquirySummary: {
        totalEnquiries: enquiryTotal,
        enquiries: authorizedEnquiries,
      },
    };
  }

  /**
   * Create customer with validated phone, optional email, and audit log
   */
  static async createCustomer(ctx: AuthContext, input: CustomerCreateInput) {
    if (!ctx.hasPermission("customers", "create")) {
      throw new ForbiddenError("Permission denied: customers.create required");
    }

    const companyId = ctx.company.id;
    const defaultCountry = ctx.company.defaultCountryCode || "IN";

    // 1. Validate & Normalize primary phone
    const norm = PhoneNormalizer.normalize(input.phone, defaultCountry);
    if (!norm.isValid || !norm.normalized) {
      throw new ValidationError(`Invalid phone number: ${norm.error || "Must be valid"}`);
    }

    const normalizedPhone = norm.normalized;

    // 2. Prevent duplicate normalized phone within tenant
    const existingPhone = await prisma.customerPhone.findUnique({
      where: {
        companyId_normalizedPhone: {
          companyId,
          normalizedPhone,
        },
      },
      include: { customer: true },
    });

    if (existingPhone) {
      throw new ConflictError(
        `A customer with phone ${normalizedPhone} already exists in your organization (${existingPhone.customer.name})`
      );
    }

    // 3. Prevent duplicate email within tenant if provided
    let cleanEmail: string | null = null;
    if (input.email && input.email.trim()) {
      cleanEmail = input.email.trim().toLowerCase();
      const existingEmail = await prisma.customerEmail.findUnique({
        where: {
          companyId_email: {
            companyId,
            email: cleanEmail,
          },
        },
        include: { customer: true },
      });

      if (existingEmail) {
        throw new ConflictError(
          `A customer with email ${cleanEmail} already exists in your organization (${existingEmail.customer.name})`
        );
      }
    }

    // 4. Atomic transaction: Customer + CustomerPhone + CustomerEmail + AuditLog
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          companyId,
          name: input.name.trim(),
          displayName: input.displayName?.trim() || null,
          companyName: input.companyName?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });

      const phone = await tx.customerPhone.create({
        data: {
          companyId,
          customerId: customer.id,
          rawPhone: input.phone.trim(),
          normalizedPhone,
          type: input.phoneType,
          isPrimary: true,
        },
      });

      let emailRecord = null;
      if (cleanEmail) {
        emailRecord = await tx.customerEmail.create({
          data: {
            companyId,
            customerId: customer.id,
            email: cleanEmail,
            type: input.emailType,
            isPrimary: true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.create",
          entityType: "Customer",
          entityId: customer.id,
          metadata: {
            name: customer.name,
            phone: normalizedPhone,
            email: cleanEmail,
          },
        },
      });

      return {
        ...customer,
        phones: [phone],
        emails: emailRecord ? [emailRecord] : [],
      };
    });

    return result;
  }

  /**
   * Update customer profile fields with audit logging
   */
  static async updateCustomer(
    ctx: AuthContext,
    id: string,
    input: CustomerUpdateInput
  ) {
    if (!ctx.hasPermission("customers", "update")) {
      throw new ForbiddenError("Permission denied: customers.update required");
    }

    const companyId = ctx.company.id;

    const existing = await prisma.customer.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("Customer not found");
    }

    const data: Prisma.CustomerUpdateInput = {};
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    if (input.name !== undefined && input.name.trim() !== existing.name) {
      data.name = input.name.trim();
      changes.name = { old: existing.name, new: data.name };
    }

    if (input.displayName !== undefined && input.displayName?.trim() !== existing.displayName) {
      data.displayName = input.displayName?.trim() || null;
      changes.displayName = { old: existing.displayName, new: data.displayName };
    }

    if (input.companyName !== undefined && input.companyName?.trim() !== existing.companyName) {
      data.companyName = input.companyName?.trim() || null;
      changes.companyName = { old: existing.companyName, new: data.companyName };
    }

    if (input.notes !== undefined && input.notes?.trim() !== existing.notes) {
      data.notes = input.notes?.trim() || null;
      changes.notes = { old: existing.notes, new: data.notes };
    }

    if (Object.keys(data).length === 0) {
      return existing;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cust = await tx.customer.update({
        where: { id },
        data,
        include: {
          phones: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.update",
          entityType: "Customer",
          entityId: id,
          metadata: JSON.parse(JSON.stringify({ changes })),
        },
      });

      return cust;
    });

    return updated;
  }

  /**
   * Soft delete customer (preserves linked enquiries and historical business records)
   */
  static async softDeleteCustomer(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("customers", "delete") && !ctx.hasPermission("customers", "manage")) {
      throw new ForbiddenError("Permission denied: customers.delete required");
    }

    const companyId = ctx.company.id;

    const existing = await prisma.customer.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { enquiries: { where: { deletedAt: null } } },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Customer not found");
    }

    await prisma.$transaction(async (tx) => {
      // Soft-delete the customer
      await tx.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Audit log the soft deletion
      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.delete",
          entityType: "Customer",
          entityId: id,
          metadata: {
            name: existing.name,
            enquiriesPreservedCount: existing._count.enquiries,
          },
        },
      });
    });

    return { success: true, enquiriesPreserved: existing._count.enquiries };
  }

  /**
   * Add a secondary/primary phone to an existing customer
   */
  static async addPhone(
    ctx: AuthContext,
    customerId: string,
    input: CustomerAddPhoneInput
  ) {
    if (!ctx.hasPermission("customers", "update") && !ctx.hasPermission("customers", "manage")) {
      throw new ForbiddenError("Permission denied: customers.update required");
    }

    const companyId = ctx.company.id;
    const defaultCountry = ctx.company.defaultCountryCode || "IN";

    // 1. Verify customer exists in tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      include: { phones: true },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    // 2. Normalize phone
    const norm = PhoneNormalizer.normalize(input.phone, defaultCountry);
    if (!norm.isValid || !norm.normalized) {
      throw new ValidationError(`Invalid phone number: ${norm.error || "Must be valid"}`);
    }

    const normalizedPhone = norm.normalized;

    // 3. Verify phone uniqueness in tenant
    const existingPhone = await prisma.customerPhone.findUnique({
      where: {
        companyId_normalizedPhone: {
          companyId,
          normalizedPhone,
        },
      },
      include: { customer: true },
    });

    if (existingPhone) {
      if (existingPhone.customerId === customerId) {
        throw new ConflictError("This customer already has this phone number registered");
      }
      throw new ConflictError(
        `Phone number already belongs to another customer in your organization (${existingPhone.customer.name})`
      );
    }

    const willBePrimary = input.isPrimary || customer.phones.length === 0;

    const phoneRecord = await prisma.$transaction(async (tx) => {
      if (willBePrimary) {
        await tx.customerPhone.updateMany({
          where: { customerId, companyId },
          data: { isPrimary: false },
        });
      }

      const created = await tx.customerPhone.create({
        data: {
          companyId,
          customerId,
          rawPhone: input.phone.trim(),
          normalizedPhone,
          type: input.type,
          isPrimary: willBePrimary,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.phone_added",
          entityType: "Customer",
          entityId: customerId,
          metadata: {
            phoneId: created.id,
            phone: normalizedPhone,
            isPrimary: willBePrimary,
          },
        },
      });

      return created;
    });

    return phoneRecord;
  }

  /**
   * Remove a phone from a customer (ensures primary invariant is maintained)
   */
  static async removePhone(ctx: AuthContext, customerId: string, phoneId: string) {
    if (!ctx.hasPermission("customers", "update") && !ctx.hasPermission("customers", "manage")) {
      throw new ForbiddenError("Permission denied: customers.update required");
    }

    const companyId = ctx.company.id;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      include: { phones: { orderBy: { createdAt: "asc" } } },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const targetPhone = customer.phones.find((p) => p.id === phoneId);
    if (!targetPhone) {
      throw new NotFoundError("Phone record not found for this customer");
    }

    if (customer.phones.length <= 1) {
      throw new ValidationError("Cannot delete the only phone number of a customer");
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerPhone.delete({
        where: { id: phoneId },
      });

      // If removed phone was primary, promote the oldest remaining phone to primary
      if (targetPhone.isPrimary) {
        const nextPhone = customer.phones.find((p) => p.id !== phoneId);
        if (nextPhone) {
          await tx.customerPhone.update({
            where: { id: nextPhone.id },
            data: { isPrimary: true },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.phone_removed",
          entityType: "Customer",
          entityId: customerId,
          metadata: {
            phoneId,
            phone: targetPhone.normalizedPhone,
          },
        },
      });
    });

    return { success: true };
  }

  /**
   * Update phone type or set as primary
   */
  static async updatePhone(
    ctx: AuthContext,
    customerId: string,
    phoneId: string,
    input: CustomerUpdatePhoneInput
  ) {
    if (!ctx.hasPermission("customers", "update") && !ctx.hasPermission("customers", "manage")) {
      throw new ForbiddenError("Permission denied: customers.update required");
    }

    const companyId = ctx.company.id;

    const phone = await prisma.customerPhone.findFirst({
      where: { id: phoneId, customerId, companyId },
    });

    if (!phone) {
      throw new NotFoundError("Phone record not found for this customer");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.customerPhone.updateMany({
          where: { customerId, companyId },
          data: { isPrimary: false },
        });
      }

      const rec = await tx.customerPhone.update({
        where: { id: phoneId },
        data: {
          type: input.type,
          isPrimary: input.isPrimary !== undefined ? input.isPrimary : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.phone_updated",
          entityType: "Customer",
          entityId: customerId,
          metadata: { phoneId, isPrimary: input.isPrimary, type: input.type },
        },
      });

      return rec;
    });

    return updated;
  }

  /**
   * Add email to customer
   */
  static async addEmail(
    ctx: AuthContext,
    customerId: string,
    input: CustomerAddEmailInput
  ) {
    if (!ctx.hasPermission("customers", "update") && !ctx.hasPermission("customers", "manage")) {
      throw new ForbiddenError("Permission denied: customers.update required");
    }

    const companyId = ctx.company.id;
    const cleanEmail = input.email.trim().toLowerCase();

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      include: { emails: true },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const existingEmail = await prisma.customerEmail.findUnique({
      where: {
        companyId_email: {
          companyId,
          email: cleanEmail,
        },
      },
      include: { customer: true },
    });

    if (existingEmail) {
      if (existingEmail.customerId === customerId) {
        throw new ConflictError("Customer already has this email registered");
      }
      throw new ConflictError(
        `Email already belongs to another customer in your organization (${existingEmail.customer.name})`
      );
    }

    const willBePrimary = input.isPrimary || customer.emails.length === 0;

    const emailRecord = await prisma.$transaction(async (tx) => {
      if (willBePrimary) {
        await tx.customerEmail.updateMany({
          where: { customerId, companyId },
          data: { isPrimary: false },
        });
      }

      const created = await tx.customerEmail.create({
        data: {
          companyId,
          customerId,
          email: cleanEmail,
          type: input.type,
          isPrimary: willBePrimary,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.email_added",
          entityType: "Customer",
          entityId: customerId,
          metadata: { emailId: created.id, email: cleanEmail, isPrimary: willBePrimary },
        },
      });

      return created;
    });

    return emailRecord;
  }

  /**
   * Remove email from customer
   */
  static async removeEmail(ctx: AuthContext, customerId: string, emailId: string) {
    if (!ctx.hasPermission("customers", "update") && !ctx.hasPermission("customers", "manage")) {
      throw new ForbiddenError("Permission denied: customers.update required");
    }

    const companyId = ctx.company.id;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      include: { emails: { orderBy: { createdAt: "asc" } } },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const targetEmail = customer.emails.find((e) => e.id === emailId);
    if (!targetEmail) {
      throw new NotFoundError("Email record not found for this customer");
    }

    await prisma.$transaction(async (tx) => {
      await tx.customerEmail.delete({
        where: { id: emailId },
      });

      if (targetEmail.isPrimary) {
        const nextEmail = customer.emails.find((e) => e.id !== emailId);
        if (nextEmail) {
          await tx.customerEmail.update({
            where: { id: nextEmail.id },
            data: { isPrimary: true },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.email_removed",
          entityType: "Customer",
          entityId: customerId,
          metadata: { emailId, email: targetEmail.email },
        },
      });
    });

    return { success: true };
  }

  /**
   * Update email type or set as primary
   */
  static async updateEmail(
    ctx: AuthContext,
    customerId: string,
    emailId: string,
    input: CustomerUpdateEmailInput
  ) {
    if (!ctx.hasPermission("customers", "update") && !ctx.hasPermission("customers", "manage")) {
      throw new ForbiddenError("Permission denied: customers.update required");
    }

    const companyId = ctx.company.id;

    const email = await prisma.customerEmail.findFirst({
      where: { id: emailId, customerId, companyId },
    });

    if (!email) {
      throw new NotFoundError("Email record not found for this customer");
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.customerEmail.updateMany({
          where: { customerId, companyId },
          data: { isPrimary: false },
        });
      }

      const rec = await tx.customerEmail.update({
        where: { id: emailId },
        data: {
          type: input.type,
          isPrimary: input.isPrimary !== undefined ? input.isPrimary : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: ctx.user.id,
          action: "customer.email_updated",
          entityType: "Customer",
          entityId: customerId,
          metadata: { emailId, isPrimary: input.isPrimary, type: input.type },
        },
      });

      return rec;
    });

    return updated;
  }

  /**
   * Get sanitized, authorized customer history preview for Create Enquiry workflow.
   * Enforces:
   * 1. Tenant isolation
   * 2. Administrator policy (createEnquiryHistoryEnabled)
   * 3. Caller Data Scope on enquiries (getLeadDataScopeWhere)
   * 4. Admin-configured history preview fields (historyPreviewFields)
   * 5. Never leaks sensitive internal notes, private remarks, or unauthorized records.
   */
  static async getCustomerHistoryPreview(ctx: AuthContext, customerId: string) {
    const canView =
      ctx.hasPermission("leads", "view") ||
      ctx.hasPermission("leads", "create") ||
      ctx.hasPermission("customers", "view") ||
      ctx.role.name === "Admin";

    if (!canView) {
      throw new ForbiddenError("Permission denied: insufficient permissions to view history preview");
    }

    const companyId = ctx.company.id;

    // 1. Fetch customer ensuring tenant isolation
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        companyId,
        deletedAt: null,
      },
      include: {
        phones: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    // 2. Check administrator setting: is history preview enabled?
    const isEnabled = ctx.company.createEnquiryHistoryEnabled ?? true;
    if (!isEnabled && !ctx.hasPermission("settings", "manage") && ctx.role.name !== "Admin") {
      return {
        allowed: false,
        message: "Customer history preview is disabled by administrator policy",
        customer: {
          id: customer.id,
          name: customer.name,
        },
        enquiries: [],
        totalAuthorizedEnquiries: 0,
      };
    }

    // 3. Resolve caller's Data Scope for leads
    const leadScopeWhere = await getLeadDataScopeWhere(ctx, "view");

    const enquiryWhere: Prisma.LeadWhereInput = {
      customerId: customer.id,
      companyId,
      deletedAt: null,
      ...leadScopeWhere,
    };

    // 4. Query only authorized historical enquiries
    const [totalAuthorizedEnquiries, rawEnquiries] = await Promise.all([
      prisma.lead.count({ where: enquiryWhere }),
      prisma.lead.findMany({
        where: enquiryWhere,
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          quotedPrice: true,
          amount: true,
          offeringId: true,
          status: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          offering: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // 5. Read preview field visibility config
    const configuredFields = (ctx.company.historyPreviewFields || {}) as Record<string, boolean>;
    const showCustomerName = configuredFields.customerName ?? true;
    const showProductService = configuredFields.productService ?? true;
    const showStatus = configuredFields.status ?? true;
    const showPrice = configuredFields.quotedPrice ?? false;
    const showAssignedUser = configuredFields.assignedUser ?? false;
    const showLastInteraction = configuredFields.lastInteraction ?? true;

    // 6. Map to sanitized preview items (strictly NO notes, NO private custom fields, NO admin data)
    const sanitizedEnquiries = rawEnquiries.map((e) => ({
      id: e.id,
      createdAt: e.createdAt,
      lastInteractionAt: showLastInteraction ? e.updatedAt : undefined,
      status: showStatus && e.status ? { name: e.status.name, color: e.status.color } : null,
      offering:
        showProductService && e.offering
          ? { name: e.offering.name, type: e.offering.type }
          : null,
      quotedPrice: showPrice ? (e.quotedPrice ?? e.amount)?.toString() : undefined,
      assignedUser: showAssignedUser && e.assignedUser ? { name: e.assignedUser.name } : undefined,
    }));

    return {
      allowed: true,
      customer: {
        id: customer.id,
        name: showCustomerName ? customer.name : "Existing Customer",
        displayName: customer.displayName,
        companyName: customer.companyName,
        phone: customer.phones[0]?.normalizedPhone || customer.phones[0]?.rawPhone,
      },
      enquiries: sanitizedEnquiries,
      totalAuthorizedEnquiries,
    };
  }
}
