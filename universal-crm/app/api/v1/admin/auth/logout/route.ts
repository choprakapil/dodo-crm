import { withObservability } from "@/lib/observability";
/**
 * Super Admin Logout Route Handler
 * POST /api/v1/admin/auth/logout
 */

import { NextRequest, NextResponse } from "next/server";
import { SuperAdminAuthService } from "@/lib/services/super-admin-auth.service";
import { getSuperAdminSessionToken, clearSuperAdminSessionCookie } from "@/lib/auth/cookies";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const rawToken = req.cookies.get("universal_crm_superadmin_session")?.value ?? (await getSuperAdminSessionToken());
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    if (rawToken) {
      await SuperAdminAuthService.logout(rawToken, {
        ipAddress: ip,
        userAgent,
      });
    }

    await clearSuperAdminSessionCookie();

    return NextResponse.json(
      {
        success: true,
        message: "Successfully logged out.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
