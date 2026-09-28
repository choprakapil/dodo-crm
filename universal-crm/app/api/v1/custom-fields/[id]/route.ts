import { withObservability } from "@/lib/observability";
/**
 * Single Custom Field API Route
 * GET    /api/v1/custom-fields/[id] — Retrieve custom field details
 * PATCH  /api/v1/custom-fields/[id] — Update custom field definition
 * DELETE /api/v1/custom-fields/[id] — Delete/deactivate custom field
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomFieldService } from "@/lib/services/custom-field.service";
import { customFieldUpdateSchema } from "@/lib/validations/custom-field";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const field = await CustomFieldService.getCustomFieldById(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: field,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withObservability(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json();
    const parseResult = customFieldUpdateSchema.safeParse(body);
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

    const field = await CustomFieldService.updateCustomField(
      authContext,
      id,
      parseResult.data
    );

    return NextResponse.json(
      {
        success: true,
        data: field,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const DELETE = withObservability(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const result = await CustomFieldService.deleteCustomField(authContext, id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
