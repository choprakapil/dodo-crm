/**
 * Follow-up / Task Validation Schemas
 *
 * Implements strict input validation, normalization, and mass assignment prevention.
 * Never allows client to supply companyId, id, createdAt, or arbitrary timestamps.
 */

import { z } from "zod";
import { TaskPriority, TaskStatus } from "@prisma/client";

export const followUpPrioritySchema = z.nativeEnum(TaskPriority);
export const followUpStatusSchema = z.nativeEnum(TaskStatus);

export const followUpCreateSchema = z.object({
  leadId: z.string().trim().optional().nullable().or(z.literal("")),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .max(5000, "Description cannot exceed 5000 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  dueAt: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val === "") return null;
      const d = typeof val === "string" ? new Date(val) : val;
      if (isNaN(d.getTime())) {
        throw new Error("Invalid due date/time format");
      }
      return d;
    }),
  priority: followUpPrioritySchema.default(TaskPriority.MEDIUM),
  assignedUserId: z.string().trim().optional().nullable().or(z.literal("")),
  teamId: z.string().trim().optional().nullable().or(z.literal("")),
});

export type FollowUpCreateInput = z.input<typeof followUpCreateSchema>;

export const followUpUpdateSchema = z.object({
  leadId: z.string().trim().optional().nullable().or(z.literal("")),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(5000, "Description cannot exceed 5000 characters")
    .optional()
    .nullable()
    .or(z.literal("")),
  dueAt: z
    .union([z.string(), z.date()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (val === null || val === "") return null;
      const d = typeof val === "string" ? new Date(val) : val;
      if (isNaN(d.getTime())) {
        throw new Error("Invalid due date/time format");
      }
      return d;
    }),
  priority: followUpPrioritySchema.optional(),
  status: followUpStatusSchema.optional(),
  assignedUserId: z.string().trim().optional().nullable().or(z.literal("")),
  teamId: z.string().trim().optional().nullable().or(z.literal("")),
});

export type FollowUpUpdateInput = z.input<typeof followUpUpdateSchema>;

export const followUpListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: followUpStatusSchema.optional(),
  priority: followUpPrioritySchema.optional(),
  assignedUserId: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  dueFilter: z.enum(["all", "today", "upcoming", "overdue", "completed", "cancelled"]).default("all"),
  search: z.string().trim().optional(),
  sortBy: z.enum(["dueAt", "createdAt", "priority", "title"]).default("dueAt"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type FollowUpListQuery = z.infer<typeof followUpListQuerySchema>;

export const followUpRescheduleSchema = z.object({
  dueAt: z
    .union([z.string(), z.date()])
    .transform((val) => {
      const d = typeof val === "string" ? new Date(val) : val;
      if (isNaN(d.getTime())) {
        throw new Error("Invalid due date/time format");
      }
      return d;
    }),
  reason: z.string().trim().max(1000).optional().nullable(),
  dispositionId: z.string().trim().optional().nullable(),
});

export type FollowUpRescheduleInput = z.infer<typeof followUpRescheduleSchema>;

export const followUpCompleteSchema = z.object({
  outcome: z.string().trim().max(1000).optional().nullable(),
  dispositionId: z.string().trim().optional().nullable(),
});

export type FollowUpCompleteInput = z.infer<typeof followUpCompleteSchema>;

export const followUpCancelSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
  dispositionId: z.string().trim().optional().nullable(),
});

export type FollowUpCancelInput = z.infer<typeof followUpCancelSchema>;
