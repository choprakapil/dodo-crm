/**
 * Apply Template Route
 * POST /api/v1/templates/:key/apply
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
    let forceSwitch: boolean | undefined;
    try {
      const body = await req.json();
      if (typeof body?.version === "number") {
        version = body.version;
      }
      if (typeof body?.forceSwitch === "boolean") {
        forceSwitch = body.forceSwitch;
      }
    } catch {
      // Body is optional
    }

    const result = await TemplateService.applyTemplate(
      authContext,
      resolvedParams.key,
      version,
      { forceSwitch }
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Industry template "${result.templateKey}" (v${result.templateVersion}) applied successfully.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
