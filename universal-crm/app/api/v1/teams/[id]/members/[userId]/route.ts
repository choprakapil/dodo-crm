import { withObservability } from "@/lib/observability";
/**
 * Team Member Removal API Route
 * DELETE /api/v1/teams/:id/members/:userId — Remove user from team
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TeamService } from "@/lib/services/team.service";
import { handleApiError } from "@/lib/errors";

export const DELETE = withObservability(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id, userId } = await params;

    const result = await TeamService.removeTeamMember(authContext, id, userId);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
