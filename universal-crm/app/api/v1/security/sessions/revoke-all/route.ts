import { withObservability } from "@/lib/observability";
/**
 * Revoke All Sessions API Route
 * POST /api/v1/security/sessions/revoke-all — Revoke all other active sessions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SecurityService } from "@/lib/services/security.service";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const result = await SecurityService.revokeAllOtherSessions(authContext);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
