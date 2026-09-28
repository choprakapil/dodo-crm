import { withObservability } from "@/lib/observability";
/**
 * Analytics Export API Route
 * GET /api/v1/analytics/export — Export scoped analytics reports to CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AnalyticsService } from "@/lib/services/analytics.service";
import { analyticsExportSchema } from "@/lib/validations/analytics";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const parseResult = analyticsExportSchema.safeParse({
      report: url.searchParams.get("report") || undefined,
      preset: url.searchParams.get("preset") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      teamId: url.searchParams.get("teamId") || undefined,
      userId: url.searchParams.get("userId") || undefined,
      statusId: url.searchParams.get("statusId") || undefined,
      sourceId: url.searchParams.get("sourceId") || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { csv, filename } = await AnalyticsService.exportReportCsv(
      authContext,
      parseResult.data
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
});
