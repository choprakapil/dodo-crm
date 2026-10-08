import { withObservability } from "@/lib/observability";
/**
 * Individual Division API Route
 * GET    /api/v1/divisions/[id] — Get division by ID
 * PATCH  /api/v1/divisions/[id] — Update division
 * DELETE /api/v1/divisions/[id] — Delete division (with child protection)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OrganizationHierarchyService } from "@/lib/services/organization-hierarchy.service";
import { updateDivisionSchema } from "@/lib/validations/team";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const division = await OrganizationHierarchyService.getDivisionById(authContext, id);
    return NextResponse.json({ success: true, data: division }, { status: 200 });
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
    const parseResult = updateDivisionSchema.safeParse(body);
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

    const updated = await OrganizationHierarchyService.updateDivision(authContext, id, parseResult.data);
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

    const result = await OrganizationHierarchyService.deleteDivision(authContext, id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
