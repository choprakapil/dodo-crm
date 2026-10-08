import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformUserService } from "@/lib/services/platform-user.service";
import { handleApiError, ValidationError } from "@/lib/errors";
import { UserStatus } from "@prisma/client";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id } = await params;
    const body = await req.json();

    if (!body.status || !Object.values(UserStatus).includes(body.status)) {
      throw new ValidationError("Valid status (ACTIVE or DISABLED) is required.");
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const user = await PlatformUserService.updateUserStatus(
      id,
      body.status,
      session.superAdmin.id,
      { ipAddress, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: `User status successfully updated to ${body.status}.`,
      data: user,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
