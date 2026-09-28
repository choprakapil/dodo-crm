import { withObservability } from "@/lib/observability";
/**
 * Reset Password Route Handler
 * POST /api/v1/auth/reset-password
 *
 * Security: Enforces single-use tokens, token expiration, password strength,
 * and immediate revocation of all existing user sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/auth/validation";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { hashToken } from "@/lib/utils/tokens";
import { rateLimiter } from "@/lib/services/rate-limit";
import { handleApiError, ValidationError, RateLimitError } from "@/lib/errors";
import { UserStatus } from "@prisma/client";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

    // Rate limiting by IP: 5 attempts per 15 min
    const ipLimit = await rateLimiter.check({
      key: `reset_pw:ip:${ip}`,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.success) {
      throw new RateLimitError("Too many password reset attempts. Please try again later.");
    }

    const body = await req.json();
    const parseResult = resetPasswordSchema.safeParse(body);
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

    const { token, password } = parseResult.data;
    const tokenHash = hashToken(token);

    // Look up token
    const resetTokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: { company: true },
        },
      },
    });

    if (!resetTokenRecord) {
      throw new ValidationError("Invalid or expired password reset token.");
    }

    // Check if token has already been used (single-use enforcement)
    if (resetTokenRecord.usedAt !== null) {
      throw new ValidationError("This password reset link has already been used.");
    }

    // Check token expiry
    if (resetTokenRecord.expiresAt <= new Date()) {
      throw new ValidationError("Password reset link has expired. Please request a new one.");
    }

    const { user } = resetTokenRecord;

    // Check user status
    if (user.deletedAt !== null || user.status === UserStatus.DISABLED) {
      throw new ValidationError("Account is not active.");
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password and mark token used atomically
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetTokenRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Invalidate ALL existing active sessions for this user
    await revokeAllUserSessions(user.id);

    // Audit log
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: "auth.password_reset_completed",
        ipAddress: ip,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Password has been successfully reset. Please sign in with your new password.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
