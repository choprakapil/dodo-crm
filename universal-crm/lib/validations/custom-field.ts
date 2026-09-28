/**
 * Custom Field Validation Schemas and Runtime Type Checkers
 */

import { z } from "zod";
import { CustomFieldType } from "@prisma/client";
import { ValidationError } from "@/lib/errors";

export const customFieldTypeSchema = z.enum([
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "SELECT",
  "MULTI_SELECT",
  "URL",
  "EMAIL",
  "PHONE",
]);

export const customFieldCreateSchema = z
  .object({
    entityType: z.string().default("LEAD"),
    key: z
      .string()
      .trim()
      .min(2, "Field key must be at least 2 characters")
      .max(50, "Field key cannot exceed 50 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Field key must contain only lowercase alphanumeric characters and underscores"
      ),
    label: z
      .string()
      .trim()
      .min(1, "Label is required")
      .max(100, "Label cannot exceed 100 characters"),
    description: z.string().trim().max(500).optional().nullable(),
    fieldType: customFieldTypeSchema,
    required: z.boolean().default(false),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    options: z.array(z.string().trim().min(1)).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.fieldType === "SELECT" || data.fieldType === "MULTI_SELECT") {
      if (!data.options || data.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Options are required for SELECT and MULTI_SELECT fields",
          path: ["options"],
        });
      } else {
        const uniqueOptions = new Set(data.options.map((o) => o.toLowerCase()));
        if (uniqueOptions.size !== data.options.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Options must be unique",
            path: ["options"],
          });
        }
      }
    }
  });

export const customFieldUpdateSchema = z
  .object({
    label: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    required: z.boolean().optional(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    options: z.array(z.string().trim().min(1)).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.options) {
      const uniqueOptions = new Set(data.options.map((o) => o.toLowerCase()));
      if (uniqueOptions.size !== data.options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Options must be unique",
          path: ["options"],
        });
      }
    }
  });

export const customFieldReorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      sortOrder: z.number().int(),
    })
  ),
});

export type CustomFieldCreateInput = z.input<typeof customFieldCreateSchema>;
export type CustomFieldUpdateInput = z.input<typeof customFieldUpdateSchema>;
export type CustomFieldReorderInput = z.input<typeof customFieldReorderSchema>;

/**
 * Validates a single custom field value against its definition.
 * Returns normalized value or throws ValidationError.
 */
export function validateCustomFieldValue(
  field: {
    key: string;
    label: string;
    fieldType: CustomFieldType;
    required: boolean;
    options?: unknown;
  },
  val: unknown
): unknown {
  // 1. Required Check
  if (val === null || val === undefined || val === "" || (Array.isArray(val) && val.length === 0)) {
    if (field.required) {
      throw new ValidationError(`Field "${field.label}" is required`);
    }
    return null;
  }

  // 2. Type-specific Validation & Normalization
  switch (field.fieldType) {
    case "TEXT": {
      if (typeof val !== "string" && typeof val !== "number") {
        throw new ValidationError(`Field "${field.label}" must be a string`);
      }
      return String(val).trim();
    }

    case "TEXTAREA": {
      if (typeof val !== "string" && typeof val !== "number") {
        throw new ValidationError(`Field "${field.label}" must be text`);
      }
      return String(val).trim();
    }

    case "NUMBER": {
      const num = Number(val);
      if (isNaN(num)) {
        throw new ValidationError(`Field "${field.label}" must be a valid number`);
      }
      return num;
    }

    case "BOOLEAN": {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") {
        const lower = val.toLowerCase().trim();
        if (lower === "true" || lower === "yes" || lower === "1") return true;
        if (lower === "false" || lower === "no" || lower === "0") return false;
      }
      if (typeof val === "number") {
        if (val === 1) return true;
        if (val === 0) return false;
      }
      throw new ValidationError(`Field "${field.label}" must be a boolean (true/false)`);
    }

    case "DATE":
    case "DATETIME": {
      const d = new Date(val as string | number | Date);
      if (isNaN(d.getTime())) {
        throw new ValidationError(`Field "${field.label}" must be a valid date`);
      }
      return d.toISOString();
    }

    case "SELECT": {
      const strVal = String(val).trim();
      const rawOptions = Array.isArray(field.options) ? (field.options as string[]) : [];
      const match = rawOptions.find((opt) => opt.toLowerCase() === strVal.toLowerCase());
      if (!match) {
        throw new ValidationError(
          `Invalid option "${strVal}" for field "${field.label}". Valid options: ${rawOptions.join(", ")}`
        );
      }
      return match;
    }

    case "MULTI_SELECT": {
      let items: string[] = [];
      if (Array.isArray(val)) {
        items = val.map((v) => String(v).trim());
      } else if (typeof val === "string") {
        items = val.split(";").map((v) => v.trim()).filter(Boolean);
      } else {
        throw new ValidationError(`Field "${field.label}" must be an array of selected options`);
      }

      const rawOptions = Array.isArray(field.options) ? (field.options as string[]) : [];
      const normalizedItems: string[] = [];

      for (const item of items) {
        const match = rawOptions.find((opt) => opt.toLowerCase() === item.toLowerCase());
        if (!match) {
          throw new ValidationError(
            `Invalid option "${item}" for multi-select field "${field.label}". Valid options: ${rawOptions.join(", ")}`
          );
        }
        if (!normalizedItems.includes(match)) {
          normalizedItems.push(match);
        }
      }
      return normalizedItems;
    }

    case "EMAIL": {
      const strVal = String(val).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(strVal)) {
        throw new ValidationError(`Field "${field.label}" must be a valid email address`);
      }
      return strVal;
    }

    case "PHONE": {
      const strVal = String(val).trim();
      if (strVal.length < 5 || strVal.length > 30) {
        throw new ValidationError(`Field "${field.label}" must be a valid phone number`);
      }
      return strVal;
    }

    case "URL": {
      const strVal = String(val).trim();
      try {
        const parsed = new URL(strVal);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error();
        }
        return strVal;
      } catch {
        throw new ValidationError(`Field "${field.label}" must be a valid HTTP/HTTPS URL`);
      }
    }

    default:
      return val;
  }
}
