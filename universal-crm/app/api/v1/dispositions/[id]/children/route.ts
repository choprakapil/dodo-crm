import { withObservability } from "@/lib/observability";
/**
 * Disposition Children & Hierarchy Stats API Route
 * GET /api/v1/dispositions/[id]/children — Get direct children and subtree statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DispositionService } from "@/lib/services/disposition.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const data = await DispositionService.getDispositionChildren(authContext, id);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
