import { withObservability } from "@/lib/observability";
/**
 * Forgot Password Route Handler
 * POST /api/v1/auth/forgot-password
 *
 * Security: Generic 200 response to prevent account enumeration.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { generateSecureToken, hashToken } from "@/lib/utils/tokens";
import { emailService, EmailTemplates } from "@/lib/services/email";
import { rateLimiter, RateLimits } from "@/lib/services/rate-limit";
import { handleApiError, RateLimitError } from "@/lib/errors";
import { UserStatus } from "@prisma/client";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

    // Rate limiting by IP
    const ipLimit = await rateLimiter.check({
      key: `forgot_pw:ip:${ip}`,
      limit: RateLimits.passwordReset.limit,
      windowMs: RateLimits.passwordReset.windowMs,
    });
    if (!ipLimit.success) {
      throw new RateLimitError("Too many password reset requests. Please try again later.");
    }

    const body = await req.json();
    const parseResult = forgotPasswordSchema.safeParse(body);
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

    const { email } = parseResult.data;

    // Rate limiting by email
    const emailLimit = await rateLimiter.check({
      key: `forgot_pw:email:${email}`,
      limit: RateLimits.passwordReset.limit,
      windowMs: RateLimits.passwordReset.windowMs,
    });
    if (!emailLimit.success) {
      throw new RateLimitError("Too many password reset requests for this email. Please wait.");
    }

    // Lookup active user(s) with this email
    const user = await prisma.user.findFirst({
      where: {
        email,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      include: {
        company: true,
      },
    });

    if (user && user.company.status === "ACTIVE") {
      // Invalidate any previous unused tokens for this user
      await prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
      });

      // Generate secure token with 1 hour expiration
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      // Send email
      const emailContent = EmailTemplates.passwordReset(rawToken, user.name);
      await emailService.send({
        ...emailContent,
        to: user.email,
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          action: "auth.password_reset_requested",
          ipAddress: ip,
        },
      });
    }

    // Always return success message to avoid account enumeration
    return NextResponse.json(
      {
        success: true,
        message:
          "If an account with that email exists, instructions have been sent to reset your password.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
