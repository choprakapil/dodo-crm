import { withObservability } from "@/lib/observability";
/**
 * Departments Collection API Route
 * GET  /api/v1/departments — List departments for tenant
 * POST /api/v1/departments — Create a new department
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OrganizationHierarchyService } from "@/lib/services/organization-hierarchy.service";
import { departmentQuerySchema, createDepartmentSchema } from "@/lib/validations/team";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const queryParams = {
      search: url.searchParams.get("search") || undefined,
      divisionId: url.searchParams.get("divisionId") || undefined,
      isActive: url.searchParams.get("isActive") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    };

    const parseResult = departmentQuerySchema.safeParse(queryParams);
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

    const result = await OrganizationHierarchyService.listDepartments(authContext, parseResult.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = createDepartmentSchema.safeParse(body);
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

    const department = await OrganizationHierarchyService.createDepartment(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: department,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
