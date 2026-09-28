import { withObservability } from "@/lib/observability";
/**
 * Leads Collection API Route
 * GET  /api/v1/leads — List leads with filtering, search, pagination, and data scopes
 * POST /api/v1/leads — Create new lead
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { leadCreateSchema, leadListQuerySchema } from "@/lib/validations/lead";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    // Parse search parameters
    const searchParams = req.nextUrl.searchParams;
    const queryObj: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      queryObj[key] = val;
    });

    const parsedQuery = leadListQuerySchema.safeParse(queryObj);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: parsedQuery.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const result = await LeadService.listLeads(authContext, parsedQuery.data);

    return NextResponse.json(
      {
        success: true,
        data: result.data,
        pagination: result.pagination,
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
    const parseResult = leadCreateSchema.safeParse(body);
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

    const lead = await LeadService.createLead(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: lead,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
