import { z } from "zod";

export const teamQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type TeamQueryInput = z.infer<typeof teamQuerySchema>;

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(100),
  description: z.string().trim().max(1000).optional(),
  managerId: z.string().trim().nullable().optional(),
  isActive: z.boolean().default(true),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  managerId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const teamMemberSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required"),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
