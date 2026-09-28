/**
 * Onboarding Validation Schemas
 *
 * Enforces parameter validation for Phase B.2 generic tenant onboarding.
 */

import { z } from "zod";

export const onboardingProfileSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  timezone: z.string().min(1, "Timezone is required"),
  currency: z.string().min(1, "Currency is required").max(10),
  defaultCountryCode: z.string().min(2).max(5).default("IN"),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;

export const onboardingStepSchema = z.object({
  step: z.enum(["PROFILE", "TEMPLATES", "TEAM", "OFFERINGS", "PIPELINE", "COMPLETED"]),
});

export type OnboardingStepInput = z.infer<typeof onboardingStepSchema>;
