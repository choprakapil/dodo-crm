import { withObservability } from "@/lib/observability";
/**
 * Customer Phone Item Route
 * PATCH  /api/v1/customers/[id]/phones/[phoneId] — Update phone type or set as primary
 * DELETE /api/v1/customers/[id]/phones/[phoneId] — Remove phone number from customer
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerService } from "@/lib/services/customer.service";
import { customerUpdatePhoneSchema } from "@/lib/validations/customer";
import { handleApiError } from "@/lib/errors";

export const PATCH = withObservability(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phoneId: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id, phoneId } = await params;

    const body = await req.json();
    const parseResult = customerUpdatePhoneSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid phone update input",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await CustomerService.updatePhone(
      authContext,
      id,
      phoneId,
      parseResult.data
    );

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

export const DELETE = withObservability(async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phoneId: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id, phoneId } = await params;

    const result = await CustomerService.removePhone(authContext, id, phoneId);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
