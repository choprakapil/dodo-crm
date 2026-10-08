import { withObservability } from "@/lib/observability";
/**
 * Disposition Cascade Deactivation API Route
 * POST /api/v1/dispositions/[id]/deactivate-cascade — Deactivate parent and all active child descendants safely
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DispositionService } from "@/lib/services/disposition.service";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const result = await DispositionService.deactivateWithChildren(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Successfully deactivated parent disposition and ${result.deactivatedCount - 1} descendant(s).`,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
