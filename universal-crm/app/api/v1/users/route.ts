import { withObservability } from "@/lib/observability";
/**
 * Users API Route
 * GET /api/v1/users — List tenant users with pagination, search, and filtering
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { UserService } from "@/lib/services/user.service";
import { userQuerySchema } from "@/lib/validations/user";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const queryParams = {
      search: url.searchParams.get("search") || undefined,
      status: url.searchParams.get("status") || undefined,
      roleId: url.searchParams.get("roleId") || undefined,
      teamId: url.searchParams.get("teamId") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    };

    const parseResult = userQuerySchema.safeParse(queryParams);
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

    const result = await UserService.listUsers(authContext, parseResult.data);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
