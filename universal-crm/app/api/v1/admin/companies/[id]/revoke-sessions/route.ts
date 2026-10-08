import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { prisma } from "@/lib/db";
import { PlatformAuditLogService } from "@/lib/services/platform-audit-log.service";
import { handleApiError, NotFoundError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id: companyId } = await params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundError("Company not found.");
    }

    const { count } = await prisma.session.deleteMany({
      where: { companyId },
    });

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    await PlatformAuditLogService.logAction({
      superAdminId: session.superAdmin.id,
      action: "COMPANY_SESSIONS_PURGED",
      entityType: "COMPANY",
      entityId: companyId,
      metadata: {
        companyName: company.name,
        revokedSessionCount: count,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: `Revoked all ${count} active sessions for organization ${company.name}.`,
      data: { revokedCount: count },
    });
  } catch (error) {
    return handleApiError(error);
  }
});
