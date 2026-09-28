import { withObservability } from "@/lib/observability";
/**
 * Platform Company Plan Assignment API Route
 * PATCH /api/v1/admin/companies/[id]/plan — Assign or update company subscription plan
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformPlanService } from "@/lib/services/platform-plan.service";
import { assignPlanSchema } from "@/lib/validations/platform";
import { handleApiError } from "@/lib/errors";

export const PATCH = withObservability(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireSuperAdmin(req);
    const { id } = await params;
    const body = await req.json();

    const parseResult = assignPlanSchema.safeParse(body);
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

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await PlatformPlanService.assignPlanToCompany(
      id,
      parseResult.data,
      ctx.superAdmin.id,
      { ipAddress: ip, userAgent }
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: "Subscription plan successfully updated.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
