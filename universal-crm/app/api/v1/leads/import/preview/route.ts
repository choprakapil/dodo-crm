import { withObservability } from "@/lib/observability";
/**
 * Lead Import Preview API Route
 * POST /api/v1/leads/import/preview — Parse CSV, detect columns, return sample rows
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { LeadImportService } from "@/lib/services/lead-import.service";
import { leadImportPreviewSchema } from "@/lib/validations/lead-import";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = leadImportPreviewSchema.safeParse(body);
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

    const preview = await LeadImportService.previewImport(
      authContext,
      parseResult.data.csvContent,
      parseResult.data.filename
    );

    return NextResponse.json({ success: true, data: preview }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
