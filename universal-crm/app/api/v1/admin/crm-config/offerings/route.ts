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
    const type = (searchParams.get("type") as any) || undefined;
    const search = searchParams.get("search") || undefined;

    const data = await PlatformCrmConfigService.listOfferings({ companyId, type, search });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const session = await requireSuperAdmin(req);
    const body = await req.json();

    if (!body.companyId || !body.name || !body.type || body.basePrice === undefined) {
      throw new ValidationError("companyId, name, type, and basePrice are required.");
    }

    const offering = await PlatformCrmConfigService.createOffering(
      {
        companyId: body.companyId,
        name: body.name,
        code: body.code || body.sku,
        description: body.description,
        type: body.type,
        defaultPrice: parseFloat(body.defaultPrice || body.basePrice || 0),
        currency: body.currency || "USD",
        allowSalesPriceOverride: body.allowSalesPriceOverride ?? body.allowPriceOverride ?? true,
      },
      session.superAdmin.id
    );

    return NextResponse.json({
      success: true,
      message: `${offering.type} offering '${offering.name}' created successfully.`,
      data: offering,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
