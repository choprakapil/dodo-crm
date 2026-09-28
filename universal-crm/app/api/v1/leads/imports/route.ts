import { withObservability } from "@/lib/observability";
/**
 * Lead Imports History API Route
 * GET /api/v1/leads/imports — List past import runs for tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadImportService } from "@/lib/services/lead-import.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const page = url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1;
    const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 20;

    const result = await LeadImportService.listImports(authContext, { page, limit });

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
