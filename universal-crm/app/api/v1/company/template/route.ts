import { withObservability } from "@/lib/observability";
/**
 * Tenant Applied Template Route
 * GET /api/v1/company/template
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TemplateService } from "@/lib/services/template.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);
    const applied = await TemplateService.getAppliedTemplate(authContext);

    return NextResponse.json({
      success: true,
      data: applied,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
