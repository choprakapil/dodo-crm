import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCrmConfigService } from "@/lib/services/platform-crm-config.service";
import { handleApiError, ValidationError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || undefined;

    const data = await PlatformCrmConfigService.listDispositions(companyId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const session = await requireSuperAdmin(req);
    const body = await req.json();

    if (!body.companyId || !body.name) {
      throw new ValidationError("companyId and name are required.");
    }

    const disposition = await PlatformCrmConfigService.createDisposition(
      {
        companyId: body.companyId,
        name: body.name,
        description: body.description,
        color: body.color,
        parentId: body.parentId,
        followUpMandatory: body.followUpMandatory,
        allowsClose: body.allowsClose,
        allowsConvert: body.allowsConvert,
      },
      session.superAdmin.id
    );

    return NextResponse.json({
      success: true,
      message: `Disposition '${disposition.name}' created successfully.`,
      data: disposition,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
