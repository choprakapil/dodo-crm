import { withObservability } from "@/lib/observability";
/**
 * Lead Detail API Route
 * GET    /api/v1/leads/:id — Get lead details with history and timeline
 * PATCH  /api/v1/leads/:id — Update lead details, status transitions, or assignments
 * DELETE /api/v1/leads/:id — Soft delete lead
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { leadUpdateSchema } from "@/lib/validations/lead";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const lead = await LeadService.getLeadById(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: lead,
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
    const parseResult = leadUpdateSchema.safeParse(body);
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

    const updatedLead = await LeadService.updateLead(authContext, id, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: updatedLead,
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

    const result = await LeadService.deleteLead(authContext, id);

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
