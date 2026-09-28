import { withObservability } from "@/lib/observability";
/**
 * Disposition Item API Route — Phase 7
 * GET    /api/v1/dispositions/[id] — Get single disposition
 * PATCH  /api/v1/dispositions/[id] — Update disposition
 * DELETE /api/v1/dispositions/[id] — Soft-delete disposition
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DispositionService } from "@/lib/services/disposition.service";
import { dispositionUpdateSchema } from "@/lib/validations/disposition";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const disposition = await DispositionService.getDispositionById(authContext, id);

    return NextResponse.json({ success: true, data: disposition }, { status: 200 });
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
    const parseResult = dispositionUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message || "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await DispositionService.updateDisposition(
      authContext,
      id,
      parseResult.data
    );

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
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

    const deleted = await DispositionService.deleteDisposition(authContext, id);

    return NextResponse.json(
      {
        success: true,
        data: deleted,
        message: "Disposition deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
