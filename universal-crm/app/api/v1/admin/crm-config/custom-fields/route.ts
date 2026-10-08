import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCrmConfigService } from "@/lib/services/platform-crm-config.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || undefined;

    const data = await PlatformCrmConfigService.listCustomFields(companyId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
});
