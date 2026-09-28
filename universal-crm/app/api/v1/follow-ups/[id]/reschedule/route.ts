import { withObservability } from "@/lib/observability";
/**
 * Follow-up Reschedule API Route — Phase 7
 * POST /api/v1/follow-ups/[id]/reschedule — Reschedule follow-up
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { followUpRescheduleSchema } from "@/lib/validations/follow-up";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json();
    const parseResult = followUpRescheduleSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message || "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await FollowUpService.rescheduleFollowUp(
      authContext,
      id,
      parseResult.data
    );

    return NextResponse.json(
      {
        success: true,
        data: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
