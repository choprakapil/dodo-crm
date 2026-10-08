import { withObservability } from "@/lib/observability";
/**
 * Platform Dispositions Bulk Actions API Route
 * POST /api/v1/admin/crm-config/dispositions/bulk — Activate, deactivate, or delete dispositions with hierarchy protection
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { PlatformAuditLogService } from "@/lib/services/platform-audit-log.service";
import { handleApiError } from "@/lib/errors";

const bulkDispositionActionSchema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE", "DELETE"]),
  dispositionIds: z.array(z.string().min(1)).min(1, "At least one disposition must be selected"),
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);
    const body = await req.json();

    const parseResult = bulkDispositionActionSchema.safeParse(body);
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

    const { action, dispositionIds } = parseResult.data;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const succeeded: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; error: string }[] = [];

    const dispositions = await prisma.disposition.findMany({
      where: { id: { in: dispositionIds } },
      include: {
        children: true,
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });
    const dispositionMap = new Map(dispositions.map((d) => [d.id, d]));

    for (const id of dispositionIds) {
      const disp = dispositionMap.get(id);
      if (!disp) {
        skipped.push({ id, reason: "Disposition not found" });
        continue;
      }

      try {
        switch (action) {
          case "ACTIVATE":
            await prisma.disposition.update({
              where: { id },
              data: { isActive: true },
            });
            succeeded.push(id);
            break;

          case "DEACTIVATE":
            await prisma.disposition.update({
              where: { id },
              data: { isActive: false },
            });
            succeeded.push(id);
            break;

          case "DELETE": {
            // Hierarchy Protection (PRD §8)
            if (disp.children.length > 0) {
              skipped.push({
                id,
                reason: `Blocked by hierarchy protection: Has ${disp.children.length} child sub-dispositions`,
              });
              continue;
            }

            // Lead attachment check
            if (disp._count.leads > 0) {
              await prisma.disposition.update({
                where: { id },
                data: { isActive: false },
              });
              skipped.push({
                id,
                reason: `Archived instead of deleted (attached to ${disp._count.leads} leads)`,
              });
              continue;
            }

            await prisma.disposition.delete({ where: { id } });
            succeeded.push(id);
            break;
          }
        }
      } catch (err: any) {
        failed.push({ id, error: err?.message || "Operation failed" });
      }
    }

    await PlatformAuditLogService.logAction({
      superAdminId: ctx.superAdmin.id,
      action: `BULK_DISPOSITION_${action}`,
      entityType: "DISPOSITION",
      metadata: {
        total: dispositionIds.length,
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
        total: dispositionIds.length,
        succeededCount: succeeded.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        succeeded,
        skipped,
        failed,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
