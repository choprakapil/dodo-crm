import { withObservability } from "@/lib/observability";
/**
 * User Status Toggle API Route
 * POST /api/v1/users/:id/status — Enable or disable user account
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { UserService } from "@/lib/services/user.service";
import { handleApiError } from "@/lib/errors";
import { UserStatus } from "@prisma/client";
import { z } from "zod";

const statusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json();
    const parseResult = statusSchema.safeParse(body);
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

    const updated = await UserService.setUserStatus(authContext, id, parseResult.data.status);

    return NextResponse.json(
      {
        success: true,
        data: updated,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
