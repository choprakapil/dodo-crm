import { withObservability } from "@/lib/observability";
/**
 * Platform Offerings (Products & Services) Bulk Actions API Route
 * POST /api/v1/admin/crm-config/offerings/bulk
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { PlatformAuditLogService } from "@/lib/services/platform-audit-log.service";
import { handleApiError } from "@/lib/errors";

const bulkOfferingActionSchema = z.object({
  action: z.enum(["ACTIVATE", "DEACTIVATE", "DELETE", "CHANGE_CATEGORY"]),
  offeringIds: z.array(z.string().min(1)).min(1, "At least one offering must be selected"),
  category: z.string().trim().max(100).optional(),
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);
    const body = await req.json();

    const parseResult = bulkOfferingActionSchema.safeParse(body);
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

    const { action, offeringIds, category } = parseResult.data;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const succeeded: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; error: string }[] = [];

    const offerings = await prisma.offering.findMany({
      where: { id: { in: offeringIds } },
    });
    const offeringMap = new Map(offerings.map((o) => [o.id, o]));

    for (const id of offeringIds) {
      const offering = offeringMap.get(id);
      if (!offering) {
        skipped.push({ id, reason: "Offering not found" });
        continue;
      }

      try {
        switch (action) {
          case "ACTIVATE":
            await prisma.offering.update({
              where: { id },
              data: { isActive: true },
            });
            succeeded.push(id);
            break;

          case "DEACTIVATE":
            await prisma.offering.update({
              where: { id },
              data: { isActive: false },
            });
            succeeded.push(id);
            break;

          case "CHANGE_CATEGORY":
            await prisma.offering.update({
              where: { id },
              data: { description: category ? `Category: ${category}` : null },
            });
            succeeded.push(id);
            break;

          case "DELETE":
            // Check if attached to leads
            const leadCount = await prisma.lead.count({ where: { offeringId: id } });
            if (leadCount > 0) {
              // Soft deactivate instead of hard delete to preserve foreign key integrity
              await prisma.offering.update({
                where: { id },
                data: { isActive: false },
              });
              skipped.push({ id, reason: `Archived instead of deleted (attached to ${leadCount} leads)` });
              continue;
            }
            await prisma.offering.delete({ where: { id } });
            succeeded.push(id);
            break;
        }
      } catch (err: any) {
        failed.push({ id, error: err?.message || "Operation failed" });
      }
    }

    await PlatformAuditLogService.logAction({
      superAdminId: ctx.superAdmin.id,
      action: `BULK_OFFERING_${action}`,
      entityType: "OFFERING",
      metadata: {
        total: offeringIds.length,
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
        total: offeringIds.length,
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
