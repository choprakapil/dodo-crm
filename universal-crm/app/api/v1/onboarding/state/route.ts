import { withObservability } from "@/lib/observability";
/**
 * Onboarding State API Route
 * GET /api/v1/onboarding/state — Get tenant onboarding state and setup metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OnboardingService } from "@/lib/services/onboarding.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);
    const state = await OnboardingService.getOnboardingState(authContext);

    return NextResponse.json(
      {
        success: true,
        data: state,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
