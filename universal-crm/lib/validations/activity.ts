/**
 * Activity Validation Schemas
 *
 * Implements strict input validation, normalization, and mass assignment prevention.
 * Never allows client to supply companyId, userId, id, or arbitrary timestamps.
 */

import { z } from "zod";
import { ActivityType } from "@prisma/client";

export const activityTypeSchema = z.nativeEnum(ActivityType);

export const activityCreateSchema = z.object({
  type: z.enum([
    "CALL",
    "WHATSAPP",
    "EMAIL",
    "NOTE",
    "MEETING",
    "NOTE_ADDED",
  ] as const),
  subject: z
    .string()
    .trim()
    .max(200, "Subject cannot exceed 200 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(5000, "Description cannot exceed 5000 characters"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .nullable(),
});

export type ActivityCreateInput = z.input<typeof activityCreateSchema>;

export const activityUpdateSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(5000, "Description cannot exceed 5000 characters")
    .optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .nullable(),
});

export type ActivityUpdateInput = z.input<typeof activityUpdateSchema>;

export const activityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: activityTypeSchema.optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;
