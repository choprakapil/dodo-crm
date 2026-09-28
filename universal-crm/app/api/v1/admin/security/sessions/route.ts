import { withObservability } from "@/lib/observability";
/**
 * Super Admin Sessions Security API Route
 * GET    /api/v1/admin/security/sessions — List active platform sessions
 * DELETE /api/v1/admin/security/sessions — Revoke specific or all other sessions
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { SuperAdminAuthService } from "@/lib/services/super-admin-auth.service";
import { getSuperAdminSessionToken } from "@/lib/auth/cookies";
import { handleApiError, ValidationError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);
    const rawToken = req.cookies.get("universal_crm_superadmin_session")?.value ?? (await getSuperAdminSessionToken());

    const sessions = await SuperAdminAuthService.listSessions(ctx.superAdmin.id, rawToken ?? undefined);

    return NextResponse.json(
      {
        success: true,
        data: sessions,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const DELETE = withObservability(async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);
    const rawToken = req.cookies.get("universal_crm_superadmin_session")?.value ?? (await getSuperAdminSessionToken());
    const body = await req.json().catch(() => ({}));

    if (body.revokeOthers) {
      if (!rawToken) {
        throw new ValidationError("Current session token required.");
      }
      await SuperAdminAuthService.revokeOtherSessions(ctx.superAdmin.id, rawToken);
      return NextResponse.json(
        {
          success: true,
          message: "All other platform sessions revoked.",
        },
        { status: 200 }
      );
    }

    if (body.sessionId) {
      await SuperAdminAuthService.revokeSession(ctx.superAdmin.id, body.sessionId);
      return NextResponse.json(
        {
          success: true,
          message: "Session revoked successfully.",
        },
        { status: 200 }
      );
    }

    throw new ValidationError("sessionId or revokeOthers: true is required.");
  } catch (error) {
    return handleApiError(error);
  }
});
