import { withObservability } from "@/lib/observability";
/**
 * Divisions Collection API Route
 * GET  /api/v1/divisions — List divisions for tenant
 * POST /api/v1/divisions — Create a new division
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OrganizationHierarchyService } from "@/lib/services/organization-hierarchy.service";
import { divisionQuerySchema, createDivisionSchema } from "@/lib/validations/team";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const queryParams = {
      search: url.searchParams.get("search") || undefined,
      isActive: url.searchParams.get("isActive") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
    };

    const parseResult = divisionQuerySchema.safeParse(queryParams);
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

    const result = await OrganizationHierarchyService.listDivisions(authContext, parseResult.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = createDivisionSchema.safeParse(body);
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

    const division = await OrganizationHierarchyService.createDivision(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: division,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
