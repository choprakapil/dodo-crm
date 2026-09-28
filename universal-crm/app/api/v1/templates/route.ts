import { withObservability } from "@/lib/observability";
/**
 * List Templates Route
 * GET /api/v1/templates
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TemplateService } from "@/lib/services/template.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);
    const templates = TemplateService.listTemplates(authContext);

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
