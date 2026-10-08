import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformUserService } from "@/lib/services/platform-user.service";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id } = await params;

    let customPassword: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.password === "string") {
        customPassword = body.password;
      }
    } catch {
      // Body optional
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await PlatformUserService.resetUserPassword(
      id,
      session.superAdmin.id,
      customPassword,
      { ipAddress, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: "Password reset successfully. Active sessions revoked.",
      data: result,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
