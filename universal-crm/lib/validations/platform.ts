import { z } from "zod";
import { CompanyStatus } from "@prisma/client";

export const superAdminLoginSchema = z
  .object({
    email: z.string().trim().email("Valid email address is required").toLowerCase(),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export type SuperAdminLoginInput = z.infer<typeof superAdminLoginSchema>;

export const PlanTiers = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"] as const;

export const provisionCompanySchema = z
  .object({
    name: z.string().trim().min(2, "Company name must be at least 2 characters").max(100),
    slug: z
      .string()
      .trim()
      .min(2, "Slug must be at least 2 characters")
      .max(60)
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
    initialAdminName: z.string().trim().min(1, "Initial Admin name is required").max(100),
    initialAdminEmail: z.string().trim().email("Valid initial admin email is required").toLowerCase(),
    planTier: z.enum(PlanTiers).default("STARTER"),
    timezone: z.string().trim().default("UTC"),
    currency: z.string().trim().length(3, "Currency must be a 3-letter ISO code").toUpperCase(),
  })
  .strict();

export type ProvisionCompanyInput = z.infer<typeof provisionCompanySchema>;

export const suspendCompanySchema = z
  .object({
    reason: z.string().trim().max(500, "Reason must be 500 characters or less").optional(),
  })
  .strict();

export type SuspendCompanyInput = z.infer<typeof suspendCompanySchema>;

export const assignPlanSchema = z
  .object({
    planId: z.string().trim().min(1, "Plan ID is required").optional(),
    planTier: z.enum(PlanTiers).optional(),
  })
  .refine((data) => Boolean(data.planId || data.planTier), {
    message: "Either planId or planTier must be provided",
  })
  .refine((data) => !data.planId || !data.planTier || true, {
    message: "Cannot specify both planId and planTier",
  });

export type AssignPlanInput = z.infer<typeof assignPlanSchema>;

export const updatePlanSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    maxUsers: z.number().int().positive("Max users must be greater than 0").max(100000).optional(),
    maxLeads: z.number().int().positive("Max leads must be greater than 0").max(10000000).optional(),
    features: z.record(z.string(), z.boolean()).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const platformCompanyQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(CompanyStatus).optional(),
  planTier: z.enum(PlanTiers).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["name", "createdAt", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type PlatformCompanyQueryInput = z.infer<typeof platformCompanyQuerySchema>;

export const platformAuditLogQuerySchema = z.object({
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  superAdminId: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export type PlatformAuditLogQueryInput = z.infer<typeof platformAuditLogQuerySchema>;

export const superAdminChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters long"),
  })
  .strict();

export type SuperAdminChangePasswordInput = z.infer<typeof superAdminChangePasswordSchema>;
