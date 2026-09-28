import { withObservability } from "@/lib/observability";
/**
 * Offering Detail API Route
 * GET    /api/v1/offerings/[id] — Fetch offering details
 * PATCH  /api/v1/offerings/[id] — Update offering
 * DELETE /api/v1/offerings/[id] — Soft-delete offering
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OfferingService } from "@/lib/services/offering.service";
import { offeringUpdateSchema } from "@/lib/validations/offering";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const offering = await OfferingService.getOfferingById(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: offering,
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
    const parseResult = offeringUpdateSchema.safeParse(body);
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

    const updated = await OfferingService.updateOffering(authContext, id, parseResult.data);

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

    const result = await OfferingService.softDeleteOffering(authContext, id);

    return NextResponse.json(
      {
        success: true,
        message: result.message,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
