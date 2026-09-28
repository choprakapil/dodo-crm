import { withObservability } from "@/lib/observability";
/**
 * Follow-up Lifecycle History API Route — Phase 7
 * GET /api/v1/follow-ups/[id]/history — Get lifecycle history
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const history = await FollowUpService.getFollowUpHistory(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: history,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
