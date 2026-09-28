import { withObservability } from "@/lib/observability";
/**
 * Roles Collection API Route
 * GET  /api/v1/roles — List roles with permissions
 * POST /api/v1/roles — Create a custom role
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { RoleService } from "@/lib/services/role.service";
import { createRoleSchema } from "@/lib/validations/role";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const roles = await RoleService.listRoles(authContext);

    return NextResponse.json(
      {
        success: true,
        data: roles,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = createRoleSchema.safeParse(body);
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

    const role = await RoleService.createRole(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: role,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
