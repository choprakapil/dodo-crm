import { z } from "zod";
import { UserStatus } from "@prisma/client";

export const userQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  roleId: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type UserQueryInput = z.infer<typeof userQuerySchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  roleId: z.string().trim().min(1, "Role ID is required").optional(),
  teamIds: z.array(z.string().trim()).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const adminResetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;
