import { withObservability } from "@/lib/observability";
/**
 * Team Members API Route
 * POST /api/v1/teams/:id/members — Add user to team
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TeamService } from "@/lib/services/team.service";
import { teamMemberSchema } from "@/lib/validations/team";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json();
    const parseResult = teamMemberSchema.safeParse(body);
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

    const member = await TeamService.addTeamMember(
      authContext,
      id,
      parseResult.data.userId
    );

    return NextResponse.json(
      {
        success: true,
        data: member,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
