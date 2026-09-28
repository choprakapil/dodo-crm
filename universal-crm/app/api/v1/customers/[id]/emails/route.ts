import { withObservability } from "@/lib/observability";
/**
 * Customer Emails Collection Route
 * POST /api/v1/customers/[id]/emails — Add email address to customer
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerService } from "@/lib/services/customer.service";
import { customerAddEmailSchema } from "@/lib/validations/customer";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json();
    const parseResult = customerAddEmailSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid email input",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const created = await CustomerService.addEmail(authContext, id, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
