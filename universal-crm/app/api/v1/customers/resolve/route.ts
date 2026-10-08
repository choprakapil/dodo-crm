import { withObservability } from "@/lib/observability";
/**
 * Customer Phone Resolution API Route (Read-Only Lookup)
 * GET /api/v1/customers/resolve?phone=... — Resolve existing customer by phone number
 *
 * Invariant: GET requests must NEVER mutate state or create phantom customer records.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerResolutionService } from "@/lib/services/customer-resolution.service";
import { handleApiError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const phone = req.nextUrl.searchParams.get("phone");
    if (!phone || !phone.trim()) {
      throw new ValidationError("phone query parameter is required");
    }

    const tenantCountry = authContext.company.defaultCountryCode || "IN";
    const matchedCustomer = await CustomerResolutionService.findCustomerByPhone(
      authContext.company.id,
      phone.trim(),
      tenantCountry
    );

    if (!matchedCustomer) {
      return NextResponse.json(
        {
          success: true,
          data: {
            customer: null,
            matchedBy: "NONE",
            isNew: true,
          },
        },
        { status: 200 }
      );
    }

    // Customer was found: fetch total active enquiries count under this tenant
    const enquiriesCount = await prisma.lead.count({
      where: {
        companyId: authContext.company.id,
        customerId: matchedCustomer.id,
        deletedAt: null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          customer: {
            id: matchedCustomer.id,
            name: matchedCustomer.name,
            displayName: matchedCustomer.displayName,
            companyName: matchedCustomer.companyName,
            _count: { enquiries: enquiriesCount },
          },
          matchedBy: "PHONE",
          isNew: false,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
