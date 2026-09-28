/**
 * Disposition Validation Schemas — Phase 7
 *
 * Implements strict schema validation, arbitrary-depth hierarchy rules,
 * and contradictory rule guards.
 */

import { z } from "zod";

export const dispositionCreateSchema = z
  .object({
    parentId: z.string().trim().optional().nullable().or(z.literal("")),
    name: z
      .string()
      .trim()
      .min(1, "Disposition name is required")
      .max(100, "Name cannot exceed 100 characters"),
    code: z
      .string()
      .trim()
      .max(50, "Code cannot exceed 50 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    color: z
      .string()
      .trim()
      .max(30, "Color cannot exceed 30 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    sortOrder: z.number().int().min(0).default(0),
    isTerminal: z.boolean().default(false),
    requiresFollowUp: z.boolean().default(false),
    followUpMandatory: z.boolean().default(false),
    allowsClose: z.boolean().default(true),
    allowsConvert: z.boolean().default(false),
    cancelActiveFollowUp: z.boolean().default(false),
  })
  .refine(
    (data) => !(data.cancelActiveFollowUp && data.followUpMandatory),
    {
      message:
        "Contradictory disposition rules: A disposition cannot simultaneously mandate a future follow-up (followUpMandatory: true) and cancel all active follow-ups (cancelActiveFollowUp: true).",
      path: ["cancelActiveFollowUp"],
    }
  );

export type DispositionCreateInput = z.input<typeof dispositionCreateSchema>;
export type DispositionCreateOutput = z.output<typeof dispositionCreateSchema>;

export const dispositionUpdateSchema = z
  .object({
    parentId: z.string().trim().optional().nullable().or(z.literal("")),
    name: z
      .string()
      .trim()
      .min(1, "Disposition name is required")
      .max(100, "Name cannot exceed 100 characters")
      .optional(),
    code: z
      .string()
      .trim()
      .max(50, "Code cannot exceed 50 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    color: z
      .string()
      .trim()
      .max(30, "Color cannot exceed 30 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    requiresFollowUp: z.boolean().optional(),
    followUpMandatory: z.boolean().optional(),
    allowsClose: z.boolean().optional(),
    allowsConvert: z.boolean().optional(),
    cancelActiveFollowUp: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.cancelActiveFollowUp === true && data.followUpMandatory === true) {
        return false;
      }
      return true;
    },
    {
      message:
        "Contradictory disposition rules: A disposition cannot simultaneously mandate a future follow-up (followUpMandatory: true) and cancel all active follow-ups (cancelActiveFollowUp: true).",
      path: ["cancelActiveFollowUp"],
    }
  );

export type DispositionUpdateInput = z.input<typeof dispositionUpdateSchema>;
export type DispositionUpdateOutput = z.output<typeof dispositionUpdateSchema>;

export const dispositionListQuerySchema = z.object({
  includeInactive: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  parentId: z.string().trim().optional().nullable(),
  flat: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type DispositionListQuery = z.infer<typeof dispositionListQuerySchema>;
