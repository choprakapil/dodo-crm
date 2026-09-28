import { withObservability } from "@/lib/observability";
/**
 * Permissions Catalog API Route
 * GET /api/v1/permissions — List system permission modules and actions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { RoleService } from "@/lib/services/role.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const permissions = RoleService.getAvailablePermissions();

    return NextResponse.json(
      {
        success: true,
        data: permissions,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
