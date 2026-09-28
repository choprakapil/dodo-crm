import { withObservability } from "@/lib/observability";
/**
 * Accept Invitation API Route
 * POST /api/v1/invitations/accept — Set password and activate account
 */

import { NextRequest, NextResponse } from "next/server";
import { InvitationService } from "@/lib/services/invitation.service";
import { acceptInvitationSchema } from "@/lib/validations/invitation";
import { setSessionCookie } from "@/lib/auth/cookies";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = acceptInvitationSchema.safeParse(body);
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

    const userAgent = req.headers.get("user-agent") ?? undefined;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      undefined;

    const result = await InvitationService.acceptInvitation(parseResult.data, {
      userAgent,
      ipAddress: ip,
    });

    // Set HTTP-only session cookie
    await setSessionCookie(result.session.rawToken);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: result.user,
          company: result.company,
        },
        message: "Invitation accepted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
