import { withObservability } from "@/lib/observability";
/**
 * Onboarding Complete API Route
 * POST /api/v1/onboarding/complete — Finalize onboarding and activate full tenant workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OnboardingService } from "@/lib/services/onboarding.service";
import { handleApiError } from "@/lib/errors";

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);
    const result = await OnboardingService.completeOnboarding(authContext);

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
