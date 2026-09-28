/**
 * Offering (Product & Service) Validation Schemas
 *
 * Implements strict input validation, normalization, and mass assignment prevention.
 * Never allows client to supply companyId, deletedAt, or arbitrary timestamps.
 */

import { z } from "zod";

export const offeringTypeEnum = z.enum(["PRODUCT", "SERVICE"]);

export const offeringQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().optional(),
  type: offeringTypeEnum.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .or(z.boolean())
    .optional(),
  sortBy: z.enum(["name", "defaultPrice", "createdAt", "type"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.coerce.boolean().default(false),
});

export type OfferingQueryInput = z.input<typeof offeringQuerySchema>;

export const offeringCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name cannot exceed 200 characters"),
  type: offeringTypeEnum.default("PRODUCT"),
  code: z
    .string()
    .trim()
    .max(50, "Code/SKU cannot exceed 50 characters")
    .optional()
    .nullable(),
  description: z
    .string()
    .trim()
    .max(5000, "Description cannot exceed 5000 characters")
    .optional()
    .nullable(),
  defaultPrice: z.coerce
    .number()
    .min(0, "Default price cannot be negative")
    .default(0),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(10)
    .optional(),
  isActive: z.boolean().default(true),
  allowSalesPriceOverride: z.boolean().default(true),
});

export type OfferingCreateInput = z.input<typeof offeringCreateSchema>;

export const offeringUpdateSchema = offeringCreateSchema.partial();

export type OfferingUpdateInput = z.input<typeof offeringUpdateSchema>;
