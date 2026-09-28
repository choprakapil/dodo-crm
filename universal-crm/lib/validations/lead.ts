/**
 * Lead Validation Schemas
 *
 * Implements strict input validation, normalization, and mass assignment prevention.
 * Never allows client to supply companyId, deletedAt, or arbitrary timestamps.
 */

import { z } from "zod";
import { LeadPriority } from "@prisma/client";

export const leadPrioritySchema = z.nativeEnum(LeadPriority);

export const leadCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(200, "Name cannot exceed 200 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(50, "Phone cannot exceed 50 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  company: z
    .string()
    .trim()
    .max(200, "Company name cannot exceed 200 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  amount: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? null : Math.max(0, num);
    }),
  priority: leadPrioritySchema.default(LeadPriority.MEDIUM),
  sourceId: z.string().trim().optional().nullable().or(z.literal("")),
  statusId: z.string().trim().optional().nullable().or(z.literal("")),
  assignedUserId: z.string().trim().optional().nullable().or(z.literal("")),
  teamId: z.string().trim().optional().nullable().or(z.literal("")),
  customerId: z.string().trim().optional().nullable().or(z.literal("")),
  offeringId: z.string().trim().optional().nullable().or(z.literal("")),
  quotedPrice: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null;
      const num = typeof val === "string" ? parseFloat(val) : val;
      return isNaN(num) ? null : Math.max(0, num);
    }),
  priceOverrideReason: z.string().trim().max(1000).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type LeadCreateInput = z.input<typeof leadCreateSchema>;

export const leadUpdateSchema = leadCreateSchema.partial();

export type LeadUpdateInput = z.input<typeof leadUpdateSchema>;

export const leadListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  statusId: z.string().trim().optional(),
  sourceId: z.string().trim().optional(),
  priority: leadPrioritySchema.optional(),
  assignedUserId: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  offeringId: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "amount", "priority"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

export const callOutcomeSchema = z.object({
  dispositionId: z.string().trim().min(1, "Disposition is required"),
  notes: z.string().trim().max(5000).optional().nullable(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).optional().nullable(),
  dueAt: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === "") return null;
      const d = typeof val === "string" ? new Date(val) : val;
      if (isNaN(d.getTime())) {
        throw new Error("Invalid follow-up date/time format");
      }
      return d;
    }),
  followUpReason: z.string().trim().max(1000).optional().nullable(),
  assignedUserId: z.string().trim().optional().nullable().or(z.literal("")),
});

export type CallOutcomeInput = z.input<typeof callOutcomeSchema>;
export type CallOutcomeParsed = z.output<typeof callOutcomeSchema>;

export const leadDispositionUpdateSchema = z.object({
  dispositionId: z.string().trim().min(1, "Disposition is required"),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type LeadDispositionUpdateInput = z.infer<typeof leadDispositionUpdateSchema>;

