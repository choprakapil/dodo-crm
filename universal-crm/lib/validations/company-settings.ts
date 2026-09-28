import { z } from "zod";

export const updateCompanySettingsSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(100).optional(),
  email: z.string().trim().toLowerCase().email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  website: z.string().trim().url("Invalid URL format").nullable().or(z.literal("")).optional(),
  logoUrl: z.string().trim().url("Invalid Logo URL format").nullable().or(z.literal("")).optional(),
  timezone: z.string().trim().min(1).max(50).optional(),
  currency: z.string().trim().min(1).max(10).optional(),
  dateFormat: z.string().trim().min(1).max(20).optional(),
  allowSalesPriceOverride: z.boolean().optional(),
  customerDirectoryVisibility: z.enum(["DATA_SCOPE", "COMPANY"]).optional(),
  createEnquiryHistoryEnabled: z.boolean().optional(),
  historyPreviewFields: z.record(z.string(), z.boolean()).or(z.array(z.string())).nullable().optional(),
});

export type UpdateCompanySettingsInput = z.infer<typeof updateCompanySettingsSchema>;
