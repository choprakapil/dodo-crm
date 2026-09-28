import { z } from "zod";
import { DataScope } from "@prisma/client";

export const permissionItemSchema = z.object({
  module: z.string().trim().min(1, "Module is required"),
  action: z.string().trim().min(1, "Action is required"),
  dataScope: z.nativeEnum(DataScope).default(DataScope.COMPANY),
});

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(100),
  description: z.string().trim().max(1000).optional(),
  permissions: z.array(permissionItemSchema).min(1, "At least one permission is required"),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  permissions: z.array(permissionItemSchema).optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
