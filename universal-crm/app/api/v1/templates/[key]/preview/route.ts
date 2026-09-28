/**
 * Template Dry-Run Preview Route
 * POST /api/v1/templates/:key/preview
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TemplateService } from "@/lib/services/template.service";
import { handleApiError } from "@/lib/errors";

import { withObservability } from "@/lib/observability";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> | { key: string } }
) {
  try {
    const authContext = await requireAuth(req);
    const resolvedParams = await params;

    let version: number | undefined;
    try {
      const body = await req.json();
      if (typeof body?.version === "number") {
        version = body.version;
      }
    } catch {
      // Body is optional
    }

    const report = await TemplateService.previewTemplate(
      authContext,
      resolvedParams.key,
      version
    );

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
