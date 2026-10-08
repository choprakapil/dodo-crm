import { withObservability } from "@/lib/observability";
/**
 * Super Admin Disposition Hierarchy Info API Route
 * GET /api/v1/admin/crm-config/dispositions/[id]/hierarchy — Get disposition hierarchy information and child sub-dispositions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCrmConfigService } from "@/lib/services/platform-crm-config.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(req);
    const { id } = await params;

    const data = await PlatformCrmConfigService.getDispositionHierarchyInfo(id);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
