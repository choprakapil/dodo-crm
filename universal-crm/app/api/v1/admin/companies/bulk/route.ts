import { withObservability } from "@/lib/observability";
/**
 * Platform Companies Bulk Actions API Route
 * POST /api/v1/admin/companies/bulk — Execute bulk suspension, reactivation, plan changes, or hard purges
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCompanyService } from "@/lib/services/platform-company.service";
import { PlatformPlanService } from "@/lib/services/platform-plan.service";
import { bulkCompanyActionSchema } from "@/lib/validations/platform";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);
    const body = await req.json();

    const parseResult = bulkCompanyActionSchema.safeParse(body);
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

    const { action, companyIds, planTier, reason } = parseResult.data;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const metadata = { ipAddress: ip, userAgent };

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const companyId of companyIds) {
      try {
        switch (action) {
          case "SUSPEND":
            await PlatformCompanyService.suspendCompany(companyId, reason, ctx.superAdmin.id, metadata);
            succeeded.push(companyId);
            break;

          case "REACTIVATE":
            await PlatformCompanyService.reactivateCompany(companyId, ctx.superAdmin.id, metadata);
            succeeded.push(companyId);
            break;

          case "CHANGE_PLAN":
            if (!planTier) {
              throw new Error("Plan tier is required for CHANGE_PLAN action.");
            }
            await PlatformPlanService.assignPlanToCompany(companyId, { planTier }, ctx.superAdmin.id, metadata);
            succeeded.push(companyId);
            break;

          case "PURGE":
            await PlatformCompanyService.purgeCompany(companyId, ctx.superAdmin.id, metadata);
            succeeded.push(companyId);
            break;
        }
      } catch (err: any) {
        failed.push({
          id: companyId,
          error: err?.message || "Unknown error during bulk operation",
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        action,
        total: companyIds.length,
        succeededCount: succeeded.length,
        failedCount: failed.length,
        succeeded,
        failed,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
