import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .max(255),
  roleId: z.string().trim().min(1, "Role is required"),
  teamId: z.string().trim().optional(),
  name: z.string().trim().max(100).optional(),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
