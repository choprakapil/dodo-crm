import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformFeatureService } from "@/lib/services/platform-feature.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");

    if (companyId) {
      const data = await PlatformFeatureService.getEffectiveFeatures(companyId);
      return NextResponse.json({ success: true, data });
    }

    const catalog = PlatformFeatureService.getCatalog();
    return NextResponse.json({ success: true, data: catalog });
  } catch (error) {
    return handleApiError(error);
  }
});
