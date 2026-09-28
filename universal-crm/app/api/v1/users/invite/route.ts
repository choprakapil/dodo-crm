import { withObservability } from "@/lib/observability";
/**
 * User Invitation API Route
 * POST /api/v1/users/invite — Invite a new user
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { InvitationService } from "@/lib/services/invitation.service";
import { inviteUserSchema } from "@/lib/validations/invitation";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = inviteUserSchema.safeParse(body);
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

    const result = await InvitationService.createInvitation(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
