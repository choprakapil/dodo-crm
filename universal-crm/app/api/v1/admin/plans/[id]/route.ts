import { withObservability } from "@/lib/observability";
/**
 * Platform Plan Item API Route
 * GET   /api/v1/admin/plans/[id] — Retrieve single plan definition
 * PATCH /api/v1/admin/plans/[id] — Update quota definitions and features
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformPlanService } from "@/lib/services/platform-plan.service";
import { updatePlanSchema } from "@/lib/validations/platform";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(req);
    const { id } = await params;

    const plan = await PlatformPlanService.getPlanById(id);
    return NextResponse.json(
      {
        success: true,
        data: plan,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withObservability(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireSuperAdmin(req);
    const { id } = await params;
    const body = await req.json();

    const parseResult = updatePlanSchema.safeParse(body);
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

    const updated = await PlatformPlanService.updatePlan(
      id,
      parseResult.data,
      ctx.superAdmin.id,
      { ipAddress: ip, userAgent }
    );

    return NextResponse.json(
      {
        success: true,
        data: updated,
        message: "Plan updated successfully.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
