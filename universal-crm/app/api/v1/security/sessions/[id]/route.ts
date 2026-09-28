import { withObservability } from "@/lib/observability";
/**
 * Specific Session Revocation API Route
 * DELETE /api/v1/security/sessions/:id — Revoke a specific session
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { SecurityService } from "@/lib/services/security.service";
import { handleApiError } from "@/lib/errors";

export const DELETE = withObservability(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const result = await SecurityService.revokeSession(authContext, id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
