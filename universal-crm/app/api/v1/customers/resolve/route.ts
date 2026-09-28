import { withObservability } from "@/lib/observability";
/**
 * Customer Phone Resolution API Route
 * GET /api/v1/customers/resolve?phone=... — Resolve existing customer by phone number
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerResolutionService } from "@/lib/services/customer-resolution.service";
import { handleApiError, ValidationError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const phone = req.nextUrl.searchParams.get("phone");
    if (!phone || !phone.trim()) {
      throw new ValidationError("phone query parameter is required");
    }

    const result = await CustomerResolutionService.resolveCustomer(authContext, {
      rawPhone: phone,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          customer: result.customer,
          matchedBy: result.matchedBy,
          isNew: result.isNew,
          phoneRecord: result.phoneRecord,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
