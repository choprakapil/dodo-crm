import { withObservability } from "@/lib/observability";
/**
 * Super Admin Password Change API Route
 * POST /api/v1/admin/security/change-password
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { SuperAdminAuthService } from "@/lib/services/super-admin-auth.service";
import { getSuperAdminSessionToken } from "@/lib/auth/cookies";
import { superAdminChangePasswordSchema } from "@/lib/validations/platform";
import { handleApiError, ValidationError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);
    const rawToken = req.cookies.get("universal_crm_superadmin_session")?.value ?? (await getSuperAdminSessionToken());
    if (!rawToken) {
      throw new ValidationError("Current session token missing.");
    }

    const body = await req.json();
    const parseResult = superAdminChangePasswordSchema.safeParse(body);
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

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    await SuperAdminAuthService.changePassword(
      ctx.superAdmin.id,
      parseResult.data.currentPassword,
      parseResult.data.newPassword,
      rawToken,
      { ipAddress: ip, userAgent }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Password successfully updated. All other sessions have been signed out.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
