import { withObservability } from "@/lib/observability";
/**
 * Login Route Handler
 * POST /api/v1/auth/login
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createDbSession, setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/auth/validation";
import { rateLimiter, RateLimits } from "@/lib/services/rate-limit";
import { handleApiError, UnauthorizedError, ForbiddenError, RateLimitError } from "@/lib/errors";
import { UserStatus, CompanyStatus } from "@prisma/client";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // 1. IP Rate Limiting Check
    const ipLimit = await rateLimiter.check({
      key: `login:ip:${ip}`,
      limit: RateLimits.login.limit,
      windowMs: RateLimits.login.windowMs,
    });
    if (!ipLimit.success) {
      throw new RateLimitError("Too many login attempts. Please try again later.");
    }

    // 2. Validate input body
    const body = await req.json();
    const parseResult = loginSchema.safeParse(body);
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

    const { email, password, companySlug } = parseResult.data;

    // 3. Email Rate Limiting Check
    const emailLimit = await rateLimiter.check({
      key: `login:email:${email}`,
      limit: RateLimits.login.limit,
      windowMs: RateLimits.login.windowMs,
    });
    if (!emailLimit.success) {
      throw new RateLimitError("Too many login attempts for this account. Please wait a moment.");
    }

    // 4. Find user and company
    let user;
    if (companySlug) {
      const company = await prisma.company.findUnique({
        where: { slug: companySlug },
      });
      if (!company) {
        throw new UnauthorizedError("Invalid email or password");
      }
      user = await prisma.user.findFirst({
        where: {
          companyId: company.id,
          email,
          deletedAt: null,
        },
        include: { company: true, role: true },
      });
    } else {
      user = await prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
        },
        include: { company: true, role: true },
      });
    }

    if (!user || !user.hashedPassword) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 5. Verify password
    const isPasswordValid = await verifyPassword(password, user.hashedPassword);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // 6. Verify User status
    if (user.status === UserStatus.DISABLED) {
      throw new ForbiddenError("Account is disabled. Please contact your administrator.");
    }
    if (user.status === UserStatus.INVITED) {
      throw new ForbiddenError(
        "Account invitation is pending activation. Please check your invitation email."
      );
    }

    // 7. Verify Company status
    if (user.company.status === CompanyStatus.SUSPENDED) {
      throw new ForbiddenError("Company account is suspended. Please contact support.");
    }

    // 8. Create database-backed session
    const { rawToken } = await createDbSession(user.id, user.companyId, {
      userAgent,
      ipAddress: ip,
    });

    // 9. Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 10. Audit log
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "auth.login",
        ipAddress: ip,
        metadata: {
          email: user.email,
          userAgent: userAgent?.slice(0, 200),
        },
      },
    });

    // 11. Set HTTP-only session cookie
    await setSessionCookie(rawToken);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: {
              id: user.role.id,
              name: user.role.name,
            },
          },
          company: {
            id: user.company.id,
            name: user.company.name,
            slug: user.company.slug,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
