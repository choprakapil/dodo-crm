import { withObservability } from "@/lib/observability";
/**
 * Platform Dashboard Telemetry Route Handler
 * GET /api/v1/admin/dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformDashboardService } from "@/lib/services/platform-dashboard.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const telemetry = await PlatformDashboardService.getTelemetry();

    return NextResponse.json(
      {
        success: true,
        data: telemetry,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
