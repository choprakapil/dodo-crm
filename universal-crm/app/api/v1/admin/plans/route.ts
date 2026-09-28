import { withObservability } from "@/lib/observability";
/**
 * Platform Plans API Route
 * GET /api/v1/admin/plans — List all subscription tiers and subscriber counts
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformPlanService } from "@/lib/services/platform-plan.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const plans = await PlatformPlanService.listPlans();

    return NextResponse.json(
      {
        success: true,
        data: plans,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
