import { withObservability } from "@/lib/observability";
/**
 * Super Admin Login Route Handler
 * POST /api/v1/admin/auth/login
 */

import { NextRequest, NextResponse } from "next/server";
import { SuperAdminAuthService } from "@/lib/services/super-admin-auth.service";
import { superAdminLoginSchema } from "@/lib/validations/platform";
import { setSuperAdminSessionCookie } from "@/lib/auth/cookies";
import { rateLimiter, RateLimits } from "@/lib/services/rate-limit";
import { handleApiError, RateLimitError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // 1. IP Rate Limiting Check
    const ipLimit = await rateLimiter.check({
      key: `admin_login:ip:${ip}`,
      limit: RateLimits.login.limit,
      windowMs: RateLimits.login.windowMs,
    });
    if (!ipLimit.success) {
      throw new RateLimitError("Too many login attempts. Please try again later.");
    }

    // 2. Validate input body
    const body = await req.json();
    const parseResult = superAdminLoginSchema.safeParse(body);
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

    const { email, password } = parseResult.data;

    // 3. Email Rate Limiting Check
    const emailLimit = await rateLimiter.check({
      key: `admin_login:email:${email}`,
      limit: RateLimits.login.limit,
      windowMs: RateLimits.login.windowMs,
    });
    if (!emailLimit.success) {
      throw new RateLimitError("Too many login attempts for this account. Please wait a moment.");
    }

    // 4. Authenticate Super Admin
    const { superAdmin, rawToken } = await SuperAdminAuthService.login(email, password, {
      ipAddress: ip,
      userAgent,
    });

    // 5. Set Super Admin HTTP-only session cookie
    await setSuperAdminSessionCookie(rawToken);

    return NextResponse.json(
      {
        success: true,
        data: {
          superAdmin,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
