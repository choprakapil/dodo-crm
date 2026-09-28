/**
 * Authoritative Customer Identity Resolution Service
 * 
 * Central service for resolving or creating customer identities based on
 * canonical E.164 phone numbers within strict tenant boundaries.
 * 
 * Rules:
 * 1. ONE CUSTOMER != ONE ENQUIRY (One Customer has Many Enquiries).
 * 2. Identity matching is exact on canonical E.164 normalized phone.
 * 3. Strict tenant isolation: companyId is always extracted from AuthContext.
 * 4. Never performs fuzzy matching that could mistakenly conflate two distinct people.
 * 5. Handles multiple phone numbers per customer.
 */

import { prisma } from "../db";
import { AuthContext } from "../auth/session";
import { PhoneNormalizer } from "../utils/phone";
import { ValidationError, ConflictError, NotFoundError } from "../errors";
import { Customer, CustomerPhone, Prisma } from "@prisma/client";

export interface ResolveCustomerInput {
  rawPhone?: string | null;
  email?: string | null;
  name?: string | null;
  displayName?: string | null;
  companyName?: string | null;
  customerId?: string | null;
  notes?: string | null;
}

export interface CustomerResolutionResult {
  customer: Customer;
  isNew: boolean;
  matchedBy: "EXPLICIT_ID" | "PHONE" | "CREATED";
  phoneRecord?: CustomerPhone | null;
}

export class CustomerResolutionService {
  /**
   * Resolves an existing Customer or creates a new one within the tenant organization.
   * 
   * Resolution priority:
   * 1. If customerId provided: validates existence in tenant, returns existing customer.
   * 2. If rawPhone provided: normalizes to E.164, searches CustomerPhone in tenant.
   * 3. If found: returns existing customer.
   * 4. If not found: atomically creates new Customer + CustomerPhone + CustomerEmail (if email present).
   */
  static async resolveCustomer(
    ctx: AuthContext,
    input: ResolveCustomerInput,
    client?: Prisma.TransactionClient
  ): Promise<CustomerResolutionResult> {
    const companyId = ctx.company.id;
    const db = client || prisma;

    // 1. Explicit customerId provided
    if (input.customerId) {
      const existing = await db.customer.findFirst({
        where: {
          id: input.customerId,
          companyId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new NotFoundError("Customer not found or does not belong to your organization");
      }

      // CRITICAL REQUIREMENT (PART 10): Customer + Phone Conflict Check
      // If client explicitly supplies customerId = Customer A but supplied phone belongs to Customer B, REJECT.
      if (input.rawPhone && input.rawPhone.trim()) {
        const tenantCountry = ctx.company.defaultCountryCode || "IN";
        const normResult = PhoneNormalizer.normalize(input.rawPhone, tenantCountry);
        if (normResult.isValid && normResult.normalized) {
          const existingPhone = await db.customerPhone.findUnique({
            where: {
              companyId_normalizedPhone: {
                companyId,
                normalizedPhone: normResult.normalized,
              },
            },
          });

          if (existingPhone && existingPhone.customerId !== existing.id) {
            throw new ConflictError(
              "Supplied phone number belongs to a different customer in your organization"
            );
          }
        }
      }

      return {
        customer: existing,
        isNew: false,
        matchedBy: "EXPLICIT_ID",
      };
    }

    // 2. Phone-based resolution
    if (input.rawPhone && input.rawPhone.trim()) {
      const tenantCountry = ctx.company.defaultCountryCode || "IN";
      const normResult = PhoneNormalizer.normalize(input.rawPhone, tenantCountry);
      if (!normResult.isValid || !normResult.normalized) {
        throw new ValidationError(`Invalid phone number: ${normResult.error || "Must be valid phone number"}`);
      }

      const normalizedPhone = normResult.normalized;

      // Search tenant-scoped customer_phones
      const existingPhone = await db.customerPhone.findUnique({
        where: {
          companyId_normalizedPhone: {
            companyId,
            normalizedPhone,
          },
        },
        include: {
          customer: true,
        },
      });

      if (existingPhone && existingPhone.customer && !existingPhone.customer.deletedAt) {
        // Customer found via phone match
        return {
          customer: existingPhone.customer,
          isNew: false,
          matchedBy: "PHONE",
          phoneRecord: existingPhone,
        };
      }

      // No customer found for this phone — atomically create Customer + CustomerPhone
      const customerName = input.name?.trim() || "Unknown Customer";

      const createCustomerFn = async (tx: Prisma.TransactionClient | typeof prisma) => {
        const newCustomer = await tx.customer.create({
          data: {
            companyId,
            name: customerName,
            displayName: input.displayName?.trim() || null,
            companyName: input.companyName?.trim() || null,
            notes: input.notes?.trim() || null,
          },
        });

        let newPhone;
        if (existingPhone) {
          // Reassign existing phone from soft-deleted customer to the new customer
          newPhone = await tx.customerPhone.update({
            where: { id: existingPhone.id },
            data: {
              customerId: newCustomer.id,
              rawPhone: normResult.raw,
              isPrimary: true,
            },
          });

          // Explicitly audit the phone ownership reassignment
          await tx.auditLog.create({
            data: {
              companyId,
              userId: ctx.user?.id || null,
              action: "customer_phone.reassigned",
              entityType: "CustomerPhone",
              entityId: existingPhone.id,
              metadata: {
                previousCustomerId: existingPhone.customerId,
                newCustomerId: newCustomer.id,
                normalizedPhone,
                reason: "Phone ownership transferred from soft-deleted customer to new active customer",
              },
            },
          });
        } else {
          newPhone = await tx.customerPhone.create({
            data: {
              companyId,
              customerId: newCustomer.id,
              rawPhone: normResult.raw,
              normalizedPhone,
              isPrimary: true,
            },
          });
        }

        if (input.email && input.email.trim()) {
          const cleanEmail = input.email.trim().toLowerCase();
          // Best effort link email if not already taken by active customer
          const existingEmail = await tx.customerEmail.findUnique({
            where: {
              companyId_email: {
                companyId,
                email: cleanEmail,
              },
            },
            include: { customer: true },
          });

          if (!existingEmail) {
            await tx.customerEmail.create({
              data: {
                companyId,
                customerId: newCustomer.id,
                email: cleanEmail,
                isPrimary: true,
              },
            });
          } else if (existingEmail.customer && existingEmail.customer.deletedAt !== null) {
            await tx.customerEmail.update({
              where: { id: existingEmail.id },
              data: {
                customerId: newCustomer.id,
                isPrimary: true,
              },
            });
          }
        }

        return { customer: newCustomer, phoneRecord: newPhone };
      };

      const created = client
        ? await createCustomerFn(client)
        : await prisma.$transaction(createCustomerFn);

      return {
        customer: created.customer,
        isNew: true,
        matchedBy: "CREATED",
        phoneRecord: created.phoneRecord,
      };
    }

    // 3. Neither customerId nor valid phone provided
    // If name is provided without phone, create standalone customer
    if (input.name && input.name.trim()) {
      const newCustomer = await db.customer.create({
        data: {
          companyId,
          name: input.name.trim(),
          displayName: input.displayName?.trim() || null,
          companyName: input.companyName?.trim() || null,
          notes: input.notes?.trim() || null,
        },
      });

      if (input.email && input.email.trim()) {
        const cleanEmail = input.email.trim().toLowerCase();
        const existingEmail = await db.customerEmail.findUnique({
          where: {
            companyId_email: {
              companyId,
              email: cleanEmail,
            },
          },
        });

        if (!existingEmail) {
          await db.customerEmail.create({
            data: {
              companyId,
              customerId: newCustomer.id,
              email: cleanEmail,
              isPrimary: true,
            },
          });
        }
      }

      return {
        customer: newCustomer,
        isNew: true,
        matchedBy: "CREATED",
      };
    }

    throw new ValidationError("Either a customerId, phone number, or customer name must be provided");
  }

  /**
   * Adds an additional phone number to an existing customer identity.
   */
  static async addPhoneToCustomer(
    ctx: AuthContext,
    customerId: string,
    rawPhone: string,
    options: { isPrimary?: boolean; type?: string } = {}
  ): Promise<CustomerPhone> {
    const companyId = ctx.company.id;

    // Verify customer exists and belongs to company
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found in your organization");
    }

    const tenantCountry = ctx.company.defaultCountryCode || "IN";
    const normResult = PhoneNormalizer.normalize(rawPhone, tenantCountry);
    if (!normResult.isValid || !normResult.normalized) {
      throw new ValidationError(`Invalid phone number: ${normResult.error}`);
    }

    const normalizedPhone = normResult.normalized;

    // Check if phone is already registered in this company
    const existing = await prisma.customerPhone.findUnique({
      where: {
        companyId_normalizedPhone: {
          companyId,
          normalizedPhone,
        },
      },
    });

    if (existing) {
      if (existing.customerId === customerId) {
        return existing; // Already linked to this customer
      }
      throw new ConflictError("This phone number is already associated with another customer in your organization");
    }

    // If making primary, unmark other primary phones
    if (options.isPrimary) {
      await prisma.customerPhone.updateMany({
        where: { companyId, customerId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return prisma.customerPhone.create({
      data: {
        companyId,
        customerId,
        rawPhone: normResult.raw,
        normalizedPhone,
        type: options.type || "MOBILE",
        isPrimary: options.isPrimary ?? false,
      },
    });
  }

  /**
   * Finds a customer by raw or normalized phone number strictly within the company.
   */
  static async findCustomerByPhone(
    companyId: string,
    rawPhone: string,
    tenantCountry = "IN"
  ): Promise<(Customer & { phones: CustomerPhone[] }) | null> {
    const norm = PhoneNormalizer.normalize(rawPhone, tenantCountry);
    if (!norm.isValid || !norm.normalized) {
      return null;
    }

    const phone = await prisma.customerPhone.findUnique({
      where: {
        companyId_normalizedPhone: {
          companyId,
          normalizedPhone: norm.normalized,
        },
      },
      include: {
        customer: {
          include: {
            phones: true,
          },
        },
      },
    });

    if (!phone || !phone.customer || phone.customer.deletedAt) {
      return null;
    }

    return phone.customer;
  }
}
