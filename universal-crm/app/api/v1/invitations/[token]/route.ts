import { withObservability } from "@/lib/observability";
/**
 * Public Invitation Verification API Route
 * GET /api/v1/invitations/:token — Verify invitation token details
 */

import { NextRequest, NextResponse } from "next/server";
import { InvitationService } from "@/lib/services/invitation.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await InvitationService.getInvitationByToken(token);

    return NextResponse.json(
      {
        success: true,
        data: invitation,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
