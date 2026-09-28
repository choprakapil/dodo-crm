/**
 * Get Template Details Route
 * GET /api/v1/templates/:key
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { TemplateService } from "@/lib/services/template.service";
import { handleApiError } from "@/lib/errors";

import { withObservability } from "@/lib/observability";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> | { key: string } }
) {
  try {
    await requireAuth(req);
    const resolvedParams = await params;
    const searchParams = req.nextUrl.searchParams;
    const versionParam = searchParams.get("version");
    const version = versionParam ? parseInt(versionParam, 10) : undefined;

    const template = TemplateService.getTemplate(resolvedParams.key, version);

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
