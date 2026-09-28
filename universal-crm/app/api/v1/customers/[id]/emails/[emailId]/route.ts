import { withObservability } from "@/lib/observability";
/**
 * Customer Email Item Route
 * PATCH  /api/v1/customers/[id]/emails/[emailId] — Update email type or set as primary
 * DELETE /api/v1/customers/[id]/emails/[emailId] — Remove email address from customer
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerService } from "@/lib/services/customer.service";
import { customerUpdateEmailSchema } from "@/lib/validations/customer";
import { handleApiError } from "@/lib/errors";

export const PATCH = withObservability(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id, emailId } = await params;

    const body = await req.json();
    const parseResult = customerUpdateEmailSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid email update input",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await CustomerService.updateEmail(
      authContext,
      id,
      emailId,
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
  { params }: { params: Promise<{ id: string; emailId: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id, emailId } = await params;

    const result = await CustomerService.removeEmail(authContext, id, emailId);

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
