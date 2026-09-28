import { withObservability } from "@/lib/observability";
/**
 * Custom Fields API Route
 * GET  /api/v1/custom-fields — List custom fields for tenant
 * POST /api/v1/custom-fields — Create a new custom field definition
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomFieldService } from "@/lib/services/custom-field.service";
import { customFieldCreateSchema } from "@/lib/validations/custom-field";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType") || "LEAD";
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    const fields = await CustomFieldService.listCustomFields(
      authContext,
      entityType,
      includeInactive
    );

    return NextResponse.json(
      {
        success: true,
        data: fields,
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
    const parseResult = customFieldCreateSchema.safeParse(body);
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

    const field = await CustomFieldService.createCustomField(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: field,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
