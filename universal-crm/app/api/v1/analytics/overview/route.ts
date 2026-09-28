import { withObservability } from "@/lib/observability";
/**
 * Analytics Overview API Route
 * GET /api/v1/analytics/overview — Comprehensive executive dashboard metrics & trends
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AnalyticsService } from "@/lib/services/analytics.service";
import { analyticsQuerySchema } from "@/lib/validations/analytics";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const clean = (val: string | null) => {
      if (!val || val === "undefined" || val === "null" || val.trim() === "") return undefined;
      return val.trim();
    };

    const parseResult = analyticsQuerySchema.safeParse({
      preset: clean(url.searchParams.get("preset")),
      from: clean(url.searchParams.get("from")),
      to: clean(url.searchParams.get("to")),
      teamId: clean(url.searchParams.get("teamId")),
      userId: clean(url.searchParams.get("userId")),
      statusId: clean(url.searchParams.get("statusId")),
      sourceId: clean(url.searchParams.get("sourceId")),
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

    const result = await AnalyticsService.getOverview(
      authContext,
      parseResult.data
    );

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
