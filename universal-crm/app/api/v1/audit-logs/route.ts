import { withObservability } from "@/lib/observability";
/**
 * Audit Logs API Route
 * GET /api/v1/audit-logs — List tenant audit log records with filtering
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { AuditLogService } from "@/lib/services/audit-log.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const query = {
      action: url.searchParams.get("action") || undefined,
      entityType: url.searchParams.get("entityType") || undefined,
      userId: url.searchParams.get("userId") || undefined,
      search: url.searchParams.get("search") || undefined,
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined,
      page: url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1,
      limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 25,
    };

    const result = await AuditLogService.listAuditLogs(authContext, query);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
