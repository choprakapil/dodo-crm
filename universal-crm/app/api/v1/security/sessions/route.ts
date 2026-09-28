import { withObservability } from "@/lib/observability";
/**
 * User Sessions API Route
 * GET /api/v1/security/sessions — List active sessions for current user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SecurityService } from "@/lib/services/security.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const sessions = await SecurityService.listUserSessions(authContext);

    return NextResponse.json(
      {
        success: true,
        data: sessions,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
