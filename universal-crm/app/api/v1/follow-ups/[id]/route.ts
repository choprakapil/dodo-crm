import { withObservability } from "@/lib/observability";
/**
 * Follow-up Detail API Route
 * GET     /api/v1/follow-ups/:id — Get follow-up details
 * PATCH   /api/v1/follow-ups/:id — Update follow-up
 * DELETE  /api/v1/follow-ups/:id — Delete follow-up
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { followUpUpdateSchema } from "@/lib/validations/follow-up";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const followUp = await FollowUpService.getFollowUpById(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: followUp,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withObservability(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json();
    const parseResult = followUpUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await FollowUpService.updateFollowUp(authContext, id, parseResult.data);

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

export const DELETE = withObservability(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const result = await FollowUpService.deleteFollowUp(authContext, id);

    return NextResponse.json(
      result,
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
