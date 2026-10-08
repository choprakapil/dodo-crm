import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformUsageService } from "@/lib/services/platform-usage.service";
import { handleApiError } from "@/lib/errors";

/**
 * Super Admin Storage Usage Aggregation API Handler
 *
 * GET /api/v1/admin/usage
 * Optional query parameter: ?companyId=<id> (returns single company usage report)
 *
 * Security: Strictly air-gapped to Super Admin sessions only.
 * Normal tenant users and unauthenticated requests are strictly rejected.
 */
export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (companyId) {
      const companyReport = await PlatformUsageService.getCompanyStorageUsage(companyId);
      return NextResponse.json(
        {
          success: true,
          data: companyReport,
        },
        { status: 200 }
      );
    }

    const platformReport = await PlatformUsageService.getPlatformUsageTelemetry();

    return NextResponse.json(
      {
        success: true,
        data: platformReport,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
