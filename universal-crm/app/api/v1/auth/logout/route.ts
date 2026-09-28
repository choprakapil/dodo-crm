import { withObservability } from "@/lib/observability";
/**
 * Logout Route Handler
 * POST /api/v1/auth/logout
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionToken, clearSessionCookie } from "@/lib/auth/cookies";
import { revokeSessionByToken, validateSessionToken } from "@/lib/auth/session";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();

    if (rawToken) {
      // If session exists, capture user/company for audit log before deletion
      const authContext = await validateSessionToken(rawToken);
      if (authContext) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
        await prisma.auditLog.create({
          data: {
            companyId: authContext.company.id,
            userId: authContext.user.id,
            action: "auth.logout",
            ipAddress: ip,
          },
        }).catch(() => {});
      }

      // Invalidate session in database
      await revokeSessionByToken(rawToken);
    }

    // Clear HTTP-only cookie
    await clearSessionCookie();

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
