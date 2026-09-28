import { withObservability } from "@/lib/observability";
/**
 * Onboarding Profile API Route
 * POST /api/v1/onboarding/profile — Save initial company profile and regional configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OnboardingService } from "@/lib/services/onboarding.service";
import { onboardingProfileSchema } from "@/lib/validations/onboarding";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = onboardingProfileSchema.safeParse(body);
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

    const result = await OnboardingService.updateCompanyProfile(authContext, parseResult.data);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
