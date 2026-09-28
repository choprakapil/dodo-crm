import { withObservability } from "@/lib/observability";
/**
 * Quick Complete Follow-up API Route
 * POST /api/v1/follow-ups/:id/complete
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const completed = await FollowUpService.completeFollowUp(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: completed,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
