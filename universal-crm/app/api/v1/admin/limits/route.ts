import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformLimitService } from "@/lib/services/platform-limit.service";
import { handleApiError, ValidationError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      throw new ValidationError("companyId query parameter is required.");
    }

    const report = await PlatformLimitService.getCompanyLimits(companyId);
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    return handleApiError(error);
  }
});
