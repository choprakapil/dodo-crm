import { withObservability } from "@/lib/observability";
/**
 * Platform Company Details API Route
 * GET /api/v1/admin/companies/[id] — Full tenant inspector with quotas, stats, and audit history
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCompanyService } from "@/lib/services/platform-company.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin(req);
    const { id } = await params;

    const details = await PlatformCompanyService.getCompanyDetails(id);

    return NextResponse.json(
      {
        success: true,
        data: details,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * DELETE /api/v1/admin/companies/[id] — Super Admin atomic tenant purge
 */
export const DELETE = withObservability(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id } = await params;

    let confirmSlug: string | undefined;
    try {
      const body = (await req.json()) as any;
      if (body && typeof body.confirmSlug === "string") {
        confirmSlug = body.confirmSlug;
      }
    } catch {
      // Body is optional
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await PlatformCompanyService.purgeCompany(id, session.superAdmin.id, {
      confirmSlug,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Company and all associated tenant data purged successfully.",
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
