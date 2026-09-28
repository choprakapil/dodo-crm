import { withObservability } from "@/lib/observability";
/**
 * Current User Route Handler
 * GET /api/v1/auth/me
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: authContext.user,
          company: authContext.company,
          role: authContext.role,
          permissions: authContext.permissions,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
