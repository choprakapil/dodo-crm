import { withObservability } from "@/lib/observability";
/**
 * Platform Company Reactivation API Route
 * POST /api/v1/admin/companies/[id]/reactivate — Reactivate suspended company
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCompanyService } from "@/lib/services/platform-company.service";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireSuperAdmin(req);
    const { id } = await params;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await PlatformCompanyService.reactivateCompany(id, ctx.superAdmin.id, {
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: "Company successfully reactivated.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
