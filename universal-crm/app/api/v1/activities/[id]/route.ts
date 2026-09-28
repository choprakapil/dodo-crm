import { withObservability } from "@/lib/observability";
/**
 * Activity Detail API Route
 * GET     /api/v1/activities/:id — Get activity
 * PATCH   /api/v1/activities/:id — Update activity
 * DELETE  /api/v1/activities/:id — Delete activity
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ActivityService } from "@/lib/services/activity.service";
import { activityUpdateSchema } from "@/lib/validations/activity";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const activity = await ActivityService.getActivityById(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: activity,
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
    const parseResult = activityUpdateSchema.safeParse(body);
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

    const updated = await ActivityService.updateActivity(authContext, id, parseResult.data);

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

    const result = await ActivityService.deleteActivity(authContext, id);

    return NextResponse.json(
      result,
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
