import { withObservability } from "@/lib/observability";
/**
 * Customer History Preview API Route (Phase 6)
 * GET /api/v1/customers/[id]/history-preview
 *
 * Provides a sanitized, authorized customer enquiry history preview during Create Enquiry.
 * Strictly respects caller Data Scope, tenant isolation, and Admin preview policy.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerService } from "@/lib/services/customer.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const preview = await CustomerService.getCustomerHistoryPreview(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: preview,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
