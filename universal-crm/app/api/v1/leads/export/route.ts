import { withObservability } from "@/lib/observability";
/**
 * Lead Export API Route
 * GET /api/v1/leads/export — Export scoped leads with custom fields to CSV
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadExportService } from "@/lib/services/lead-export.service";
import { leadExportQuerySchema } from "@/lib/validations/lead-export";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const query = leadExportQuerySchema.parse({
      search: url.searchParams.get("search") || undefined,
      statusId: url.searchParams.get("statusId") || undefined,
      sourceId: url.searchParams.get("sourceId") || undefined,
      priority: url.searchParams.get("priority") || undefined,
      assignedUserId: url.searchParams.get("assignedUserId") || undefined,
      teamId: url.searchParams.get("teamId") || undefined,
    });

    const { csv, filename } = await LeadExportService.exportLeadsCsv(
      authContext,
      query
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
