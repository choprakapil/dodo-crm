import { withObservability } from "@/lib/observability";
/**
 * Customer Detail API Route
 * GET    /api/v1/customers/[id] — Fetch customer profile, contacts & data-scope-filtered enquiries
 * PATCH  /api/v1/customers/[id] — Update customer profile fields
 * DELETE /api/v1/customers/[id] — Soft delete customer (preserves historical enquiries & activities)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerService } from "@/lib/services/customer.service";
import { customerUpdateSchema } from "@/lib/validations/customer";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const searchParams = req.nextUrl.searchParams;
    const enquiryPage = parseInt(searchParams.get("enquiryPage") || "1", 10) || 1;
    const enquiryLimit = parseInt(searchParams.get("enquiryLimit") || "10", 10) || 10;

    const result = await CustomerService.getCustomerById(
      authContext,
      id,
      enquiryPage,
      enquiryLimit
    );

    return NextResponse.json(
      {
        success: true,
        data: result.customer,
        enquiries: result.enquiries,
        enquiryPagination: result.enquiryPagination,
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
    const parseResult = customerUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input data",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await CustomerService.updateCustomer(
      authContext,
      id,
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const result = await CustomerService.softDeleteCustomer(authContext, id);

    return NextResponse.json(
      {
        success: true,
        message: "Customer successfully deleted",
        enquiriesPreserved: result.enquiriesPreserved,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
