import { withObservability } from "@/lib/observability";
/**
 * Super Admin Disposition Children Reassignment API Route
 * POST /api/v1/admin/crm-config/dispositions/[id]/reassign-children — Reassign child dispositions to a new parent or root
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCrmConfigService } from "@/lib/services/platform-crm-config.service";
import { dispositionReassignChildrenSchema } from "@/lib/validations/disposition";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
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

    const result = await PlatformCrmConfigService.reassignChildren(
      id,
      normalizedTargetParentId,
      session.superAdmin.id
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
