import { withObservability } from "@/lib/observability";
/**
 * Custom Fields Reorder API Route
 * POST /api/v1/custom-fields/reorder — Reorder custom fields atomically
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomFieldService } from "@/lib/services/custom-field.service";
import { customFieldReorderSchema } from "@/lib/validations/custom-field";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = customFieldReorderSchema.safeParse(body);
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

    const result = await CustomFieldService.reorderCustomFields(
      authContext,
      parseResult.data
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
