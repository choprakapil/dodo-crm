import { withObservability } from "@/lib/observability";
/**
 * Platform Audit Logs API Route
 * GET /api/v1/admin/audit-logs — Paginated platform audit trail
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformAuditLogService } from "@/lib/services/platform-audit-log.service";
import { platformAuditLogQuerySchema } from "@/lib/validations/platform";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const url = new URL(req.url);
    const queryParams = {
      action: url.searchParams.get("action") || undefined,
      entityType: url.searchParams.get("entityType") || undefined,
      entityId: url.searchParams.get("entityId") || undefined,
      superAdminId: url.searchParams.get("superAdminId") || undefined,
      search: url.searchParams.get("search") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    };

    const parseResult = platformAuditLogQuerySchema.safeParse(queryParams);
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

    const result = await PlatformAuditLogService.listLogs(parseResult.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
