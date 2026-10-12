import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformFeatureService } from "@/lib/services/platform-feature.service";
import { handleApiError, ValidationError } from "@/lib/errors";

import { featureOverridesSchema } from "@/lib/validations/platform";

export const POST = withObservability(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id } = await params;
    const body = (await req.json()) as any;

    const parseResult = featureOverridesSchema.safeParse(body?.overrides);
    if (!parseResult.success) {
      throw new ValidationError("Invalid feature overrides: " + parseResult.error.issues.map((i) => i.message).join(", "));
    }

    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const updated = await PlatformFeatureService.setCompanyFeatureOverrides(
      id,
      parseResult.data,
      session.superAdmin.id,
      { ipAddress, userAgent }
    );

    return NextResponse.json({
      success: true,
      message: "Organization feature overrides successfully saved.",
      data: updated,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
