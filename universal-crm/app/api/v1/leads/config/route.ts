import { withObservability } from "@/lib/observability";
/**
 * Lead Configuration Options API Route
 * GET /api/v1/leads/config — Returns company-scoped statuses, sources, users, and teams
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);
    const config = await LeadService.getLeadConfig(authContext);

    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
