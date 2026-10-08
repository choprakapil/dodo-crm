import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformUserService } from "@/lib/services/platform-user.service";
import { handleApiError } from "@/lib/errors";

export const DELETE = withObservability(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id } = await params;

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await PlatformUserService.revokeUserSessions(
      id,
      session.superAdmin.id,
      { ipAddress, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: `Revoked ${result.revokedCount} active user sessions.`,
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
