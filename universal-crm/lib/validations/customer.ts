/**
 * Customer Validation Schemas
 * 
 * Implements strict input validation, normalization, and mass assignment prevention.
 * Never allows client to supply companyId, deletedAt, or arbitrary timestamps.
 */

import { z } from "zod";

export const customerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeDeleted: z.coerce.boolean().default(false),
});

export type CustomerQueryInput = z.input<typeof customerQuerySchema>;

export const customerCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(200, "Name cannot exceed 200 characters"),
  displayName: z
    .string()
    .trim()
    .max(200, "Display name cannot exceed 200 characters")
    .optional()
    .nullable(),
  companyName: z
    .string()
    .trim()
    .max(200, "Company name cannot exceed 200 characters")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(5000, "Notes cannot exceed 5000 characters")
    .optional()
    .nullable(),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 characters")
    .max(50, "Phone cannot exceed 50 characters"),
  phoneType: z.enum(["MOBILE", "WORK", "HOME", "WHATSAPP"]).default("MOBILE"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal("")),
  emailType: z.enum(["WORK", "PERSONAL"]).default("WORK"),
});

export type CustomerCreateInput = z.input<typeof customerCreateSchema>;

export const customerUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name cannot be empty")
    .max(200, "Name cannot exceed 200 characters")
    .optional(),
  displayName: z
    .string()
    .trim()
    .max(200, "Display name cannot exceed 200 characters")
    .optional()
    .nullable(),
  companyName: z
    .string()
    .trim()
    .max(200, "Company name cannot exceed 200 characters")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(5000, "Notes cannot exceed 5000 characters")
    .optional()
    .nullable(),
});

export type CustomerUpdateInput = z.input<typeof customerUpdateSchema>;

export const customerAddPhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 characters")
    .max(50, "Phone cannot exceed 50 characters"),
  type: z.enum(["MOBILE", "WORK", "HOME", "WHATSAPP"]).default("MOBILE"),
  isPrimary: z.boolean().default(false),
});

export type CustomerAddPhoneInput = z.input<typeof customerAddPhoneSchema>;

export const customerUpdatePhoneSchema = z.object({
  type: z.enum(["MOBILE", "WORK", "HOME", "WHATSAPP"]).optional(),
  isPrimary: z.boolean().optional(),
});

export type CustomerUpdatePhoneInput = z.input<typeof customerUpdatePhoneSchema>;

export const customerAddEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format"),
  type: z.enum(["WORK", "PERSONAL"]).default("WORK"),
  isPrimary: z.boolean().default(false),
});

export type CustomerAddEmailInput = z.input<typeof customerAddEmailSchema>;

export const customerUpdateEmailSchema = z.object({
  type: z.enum(["WORK", "PERSONAL"]).optional(),
  isPrimary: z.boolean().optional(),
});

export type CustomerUpdateEmailInput = z.input<typeof customerUpdateEmailSchema>;
