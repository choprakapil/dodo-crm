import { withObservability } from "@/lib/observability";
/**
 * Single Lead Import Run API Route
 * GET /api/v1/leads/imports/[id] — Retrieve import run details and error summary
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadImportService } from "@/lib/services/lead-import.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const run = await LeadImportService.getImportById(authContext, id);

    return NextResponse.json({ success: true, data: run }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
