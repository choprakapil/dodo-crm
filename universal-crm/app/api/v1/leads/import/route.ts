import { withObservability } from "@/lib/observability";
/**
 * Lead Import Execution API Route
 * POST /api/v1/leads/import — Execute batch CSV import with duplicate strategy
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadImportService } from "@/lib/services/lead-import.service";
import { leadImportExecuteSchema } from "@/lib/validations/lead-import";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = leadImportExecuteSchema.safeParse(body);
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

    const result = await LeadImportService.executeImport(authContext, parseResult.data);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
