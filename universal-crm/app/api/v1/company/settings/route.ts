import { withObservability } from "@/lib/observability";
/**
 * Company Settings API Route
 * GET   /api/v1/company/settings — Get tenant settings
 * PATCH /api/v1/company/settings — Update tenant settings
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CompanySettingsService } from "@/lib/services/company-settings.service";
import { updateCompanySettingsSchema } from "@/lib/validations/company-settings";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const settings = await CompanySettingsService.getCompanySettings(authContext);

    return NextResponse.json(
      {
        success: true,
        data: settings,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withObservability(async function PATCH(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = updateCompanySettingsSchema.safeParse(body);
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

    const updated = await CompanySettingsService.updateCompanySettings(
      authContext,
      parseResult.data
    );

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
