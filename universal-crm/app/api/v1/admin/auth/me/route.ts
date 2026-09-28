import { withObservability } from "@/lib/observability";
/**
 * Super Admin Current User Route Handler
 * GET /api/v1/admin/auth/me
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);

    return NextResponse.json(
      {
        success: true,
        data: {
          superAdmin: ctx.superAdmin,
          session: {
            id: ctx.session.id,
            expiresAt: ctx.session.expiresAt,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
