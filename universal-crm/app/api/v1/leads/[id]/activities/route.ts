import { withObservability } from "@/lib/observability";
/**
 * Lead Activities API Route
 * GET   /api/v1/leads/:id/activities — List activities for lead
 * POST  /api/v1/leads/:id/activities — Create activity for lead
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ActivityService } from "@/lib/services/activity.service";
import { activityCreateSchema, activityListQuerySchema } from "@/lib/validations/activity";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const url = new URL(req.url);
    const query = activityListQuerySchema.parse({
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      type: url.searchParams.get("type") || undefined,
      search: url.searchParams.get("search") || undefined,
      sortBy: url.searchParams.get("sortBy") || undefined,
      sortOrder: url.searchParams.get("sortOrder") || undefined,
    });

    const result = await ActivityService.listActivitiesForLead(authContext, id, query);

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json();
    const parseResult = activityCreateSchema.safeParse(body);
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

    const activity = await ActivityService.createActivity(authContext, id, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: activity,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
