import { withObservability } from "@/lib/observability";
/**
 * Follow-ups API Route
 * GET   /api/v1/follow-ups — List follow-ups with filters & pagination
 * POST  /api/v1/follow-ups — Create a new follow-up
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { followUpCreateSchema, followUpListQuerySchema } from "@/lib/validations/follow-up";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const query = followUpListQuerySchema.parse({
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      status: url.searchParams.get("status") || undefined,
      priority: url.searchParams.get("priority") || undefined,
      assignedUserId: url.searchParams.get("assignedUserId") || undefined,
      teamId: url.searchParams.get("teamId") || undefined,
      leadId: url.searchParams.get("leadId") || undefined,
      dueFilter: url.searchParams.get("dueFilter") || undefined,
      search: url.searchParams.get("search") || undefined,
      sortBy: url.searchParams.get("sortBy") || undefined,
      sortOrder: url.searchParams.get("sortOrder") || undefined,
    });

    const result = await FollowUpService.listFollowUps(authContext, query);

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

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = followUpCreateSchema.safeParse(body);
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

    const followUp = await FollowUpService.createFollowUp(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: followUp,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
