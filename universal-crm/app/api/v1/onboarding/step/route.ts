import { withObservability } from "@/lib/observability";
/**
 * Onboarding Step Navigation API Route
 * POST /api/v1/onboarding/step — Set the active onboarding step for safe resumption
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OnboardingService } from "@/lib/services/onboarding.service";
import { onboardingStepSchema } from "@/lib/validations/onboarding";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = onboardingStepSchema.safeParse(body);
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

    const result = await OnboardingService.setOnboardingStep(authContext, parseResult.data.step);

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
