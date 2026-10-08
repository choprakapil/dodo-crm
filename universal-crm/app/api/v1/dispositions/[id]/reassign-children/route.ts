import { withObservability } from "@/lib/observability";
/**
 * Disposition Children Reassignment API Route
 * POST /api/v1/dispositions/[id]/reassign-children — Atomically reassign direct children to a new parent or top-level
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DispositionService } from "@/lib/services/disposition.service";
import { dispositionReassignChildrenSchema } from "@/lib/validations/disposition";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parseResult = dispositionReassignChildrenSchema.safeParse(body);
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

    const { targetParentId } = parseResult.data;
    const normalizedTargetParentId = targetParentId && targetParentId.trim() !== "" ? targetParentId.trim() : null;

    const result = await DispositionService.reassignChildren(
      authContext,
      id,
      normalizedTargetParentId
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: `Successfully reassigned ${result.count} child disposition(s).`,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
