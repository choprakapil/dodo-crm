import { withObservability } from "@/lib/observability";
/**
 * Platform Global Users Bulk Actions API Route
 * POST /api/v1/admin/users/bulk — Activate, deactivate, reset passwords, change roles, change teams, or soft delete users
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { hashPassword } from "@/lib/auth/password";
import { generateSecureToken } from "@/lib/utils/tokens";
import { UserStatus } from "@prisma/client";
import { PlatformAuditLogService } from "@/lib/services/platform-audit-log.service";
import { handleApiError } from "@/lib/errors";

const bulkUserActionSchema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE", "RESET_PASSWORD", "CHANGE_ROLE", "CHANGE_TEAM", "DELETE"]),
  userIds: z.array(z.string().min(1)).min(1, "At least one user must be selected"),
  roleId: z.string().optional(),
  teamId: z.string().nullable().optional(),
  reason: z.string().trim().max(500).optional(),
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);
    const body = await req.json();

    const parseResult = bulkUserActionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { action, userIds, roleId, teamId } = parseResult.data;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const succeeded: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; error: string }[] = [];
    const resetCredentials: { id: string; email: string; temporaryPassword: string }[] = [];

    // Fetch existing users
    const existingUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { role: true, company: true },
    });

    const userMap = new Map(existingUsers.map((u) => [u.id, u]));

    for (const userId of userIds) {
      const user = userMap.get(userId);
      if (!user) {
        skipped.push({ id: userId, reason: "User not found in system" });
        continue;
      }

      if (user.deletedAt !== null && action !== "DELETE") {
        skipped.push({ id: userId, reason: "User account is already deleted" });
        continue;
      }

      try {
        switch (action) {
          case "ACTIVATE": {
            if (user.status === UserStatus.ACTIVE) {
              skipped.push({ id: userId, reason: "User is already active" });
              continue;
            }
            await prisma.user.update({
              where: { id: userId },
              data: { status: UserStatus.ACTIVE },
            });
            succeeded.push(userId);
            break;
          }

          case "DEACTIVATE": {
            if (user.status === UserStatus.DISABLED) {
              skipped.push({ id: userId, reason: "User is already deactivated" });
              continue;
            }
            await prisma.$transaction([
              prisma.user.update({
                where: { id: userId },
                data: { status: UserStatus.DISABLED },
              }),
              prisma.session.deleteMany({
                where: { userId },
              }),
            ]);
            succeeded.push(userId);
            break;
          }

          case "RESET_PASSWORD": {
            const rawTempPassword = `Temp@${generateSecureToken(6)}!`;
            const hashedPassword = await hashPassword(rawTempPassword);

            await prisma.$transaction([
              prisma.user.update({
                where: { id: userId },
                data: { hashedPassword, status: UserStatus.ACTIVE },
              }),
              prisma.session.deleteMany({
                where: { userId },
              }),
            ]);

            resetCredentials.push({
              id: userId,
              email: user.email,
              temporaryPassword: rawTempPassword,
            });
            succeeded.push(userId);
            break;
          }

          case "CHANGE_ROLE": {
            if (!roleId) {
              throw new Error("Target Role ID is required.");
            }
            // Verify role belongs to same company or is valid tenant role
            const targetRole = await prisma.role.findFirst({
              where: { id: roleId, companyId: user.companyId },
            });
            if (!targetRole) {
              skipped.push({ id: userId, reason: "Role does not belong to user's organization" });
              continue;
            }
            await prisma.user.update({
              where: { id: userId },
              data: { roleId: targetRole.id },
            });
            succeeded.push(userId);
            break;
          }

          case "CHANGE_TEAM": {
            if (teamId) {
              const targetTeam = await prisma.team.findFirst({
                where: { id: teamId, companyId: user.companyId },
              });
              if (!targetTeam) {
                skipped.push({ id: userId, reason: "Team does not belong to user's organization" });
                continue;
              }
              // Add or update team membership
              await prisma.teamMember.upsert({
                where: {
                  teamId_userId: { teamId: targetTeam.id, userId },
                },
                create: {
                  companyId: user.companyId,
                  teamId: targetTeam.id,
                  userId,
                },
                update: {},
              });
            } else {
              // Remove all team memberships
              await prisma.teamMember.deleteMany({
                where: { userId, companyId: user.companyId },
              });
            }
            succeeded.push(userId);
            break;
          }

          case "DELETE": {
            if (user.deletedAt !== null) {
              skipped.push({ id: userId, reason: "User is already deleted" });
              continue;
            }
            await prisma.$transaction([
              prisma.user.update({
                where: { id: userId },
                data: { deletedAt: new Date(), status: UserStatus.DISABLED },
              }),
              prisma.session.deleteMany({
                where: { userId },
              }),
            ]);
            succeeded.push(userId);
            break;
          }
        }
      } catch (err: any) {
        failed.push({
          id: userId,
          error: err?.message || "Unknown error during user update",
        });
      }
    }

    // Platform Audit Log
    await PlatformAuditLogService.logAction({
      superAdminId: ctx.superAdmin.id,
      action: `BULK_USER_${action}`,
      entityType: "USER",
      metadata: {
        total: userIds.length,
        succeededCount: succeeded.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
      },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        action,
        total: userIds.length,
        succeededCount: succeeded.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        succeeded,
        skipped,
        failed,
        resetCredentials: resetCredentials.length > 0 ? resetCredentials : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
