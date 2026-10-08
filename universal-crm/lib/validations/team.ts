import { z } from "zod";

// =============================================================================
// TEAMS
// =============================================================================

export const teamQuerySchema = z.object({
  search: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  divisionId: z.string().trim().optional(),
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
  departmentId: z.string().trim().nullable().optional(),
  managerId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export type CreateTeamInput = z.input<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required").max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  departmentId: z.string().trim().nullable().optional(),
  managerId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const teamMemberSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required"),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

// =============================================================================
// DIVISIONS
// =============================================================================

export const divisionQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type DivisionQueryInput = z.infer<typeof divisionQuerySchema>;

export const createDivisionSchema = z.object({
  name: z.string().trim().min(1, "Division name is required").max(100),
  code: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  managerId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export type CreateDivisionInput = z.input<typeof createDivisionSchema>;

export const updateDivisionSchema = z.object({
  name: z.string().trim().min(1, "Division name is required").max(100).optional(),
  code: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  managerId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateDivisionInput = z.infer<typeof updateDivisionSchema>;

// =============================================================================
// DEPARTMENTS
// =============================================================================

export const departmentQuerySchema = z.object({
  search: z.string().trim().optional(),
  divisionId: z.string().trim().optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type DepartmentQueryInput = z.infer<typeof departmentQuerySchema>;

export const createDepartmentSchema = z.object({
  divisionId: z.string().trim().min(1, "Division ID is required"),
  name: z.string().trim().min(1, "Department name is required").max(100),
  code: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  managerId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export type CreateDepartmentInput = z.input<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  divisionId: z.string().trim().min(1, "Division ID is required").optional(),
  name: z.string().trim().min(1, "Department name is required").max(100).optional(),
  code: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  managerId: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

// =============================================================================
// HIERARCHY REASSIGNMENT
// =============================================================================

export const moveTeamSchema = z.object({
  departmentId: z.string().trim().nullable(),
});

export type MoveTeamInput = z.infer<typeof moveTeamSchema>;

export const moveDepartmentSchema = z.object({
  divisionId: z.string().trim().min(1, "Division ID is required"),
});

export type MoveDepartmentInput = z.infer<typeof moveDepartmentSchema>;
