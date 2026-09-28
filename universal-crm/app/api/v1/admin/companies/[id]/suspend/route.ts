import { withObservability } from "@/lib/observability";
/**
 * Platform Company Suspension API Route
 * POST /api/v1/admin/companies/[id]/suspend — Suspend company and purge all tenant sessions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCompanyService } from "@/lib/services/platform-company.service";
import { suspendCompanySchema } from "@/lib/validations/platform";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireSuperAdmin(req);
    const { id } = await params;

    let reason: string | undefined;
    try {
      const body = await req.json();
      const parseResult = suspendCompanySchema.safeParse(body);
      if (parseResult.success) {
        reason = parseResult.data.reason;
      }
    } catch {
      // Body is optional
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await PlatformCompanyService.suspendCompany(id, reason, ctx.superAdmin.id, {
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: "Company suspended and all active tenant sessions terminated.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
