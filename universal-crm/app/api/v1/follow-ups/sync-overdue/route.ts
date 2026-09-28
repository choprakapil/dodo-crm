import { withObservability } from "@/lib/observability";
/**
 * Follow-up Overdue Synchronization API Route — Phase 7
 * POST /api/v1/follow-ups/sync-overdue — Trigger atomic overdue synchronization
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    // Sync overdue follow-up tasks scoped to tenant
    const result = await FollowUpService.syncOverdueFollowUps(authContext.company.id);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
