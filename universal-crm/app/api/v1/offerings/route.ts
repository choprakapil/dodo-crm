import { withObservability } from "@/lib/observability";
/**
 * Offerings Collection API Route
 * GET  /api/v1/offerings — List products & services
 * POST /api/v1/offerings — Create a new product or service
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OfferingService } from "@/lib/services/offering.service";
import { offeringQuerySchema, offeringCreateSchema } from "@/lib/validations/offering";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const searchParams = req.nextUrl.searchParams;
    const queryObj: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      queryObj[key] = val;
    });

    const parsedQuery = offeringQuerySchema.safeParse(queryObj);
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

    const result = await OfferingService.listOfferings(authContext, parsedQuery.data);

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
    const parseResult = offeringCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request payload",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const offering = await OfferingService.createOffering(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: offering,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
