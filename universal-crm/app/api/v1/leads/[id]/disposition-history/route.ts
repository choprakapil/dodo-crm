import { withObservability } from "@/lib/observability";
/**
 * Lead Disposition History API Route — Phase 7
 * GET /api/v1/leads/[id]/disposition-history — Get disposition history for lead
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const history = await LeadService.getLeadDispositionHistory(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: history,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
