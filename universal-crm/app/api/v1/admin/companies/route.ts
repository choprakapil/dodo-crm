import { withObservability } from "@/lib/observability";
/**
 * Platform Companies API Route
 * GET  /api/v1/admin/companies — List companies with filters, search, and pagination
 * POST /api/v1/admin/companies — Provision new company with system roles, statuses, and admin invite
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformCompanyService } from "@/lib/services/platform-company.service";
import { platformCompanyQuerySchema, provisionCompanySchema } from "@/lib/validations/platform";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);

    const url = new URL(req.url);
    const queryParams = {
      search: url.searchParams.get("search") || undefined,
      status: url.searchParams.get("status") || undefined,
      planTier: url.searchParams.get("planTier") || undefined,
      page: url.searchParams.get("page") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      sortBy: url.searchParams.get("sortBy") || undefined,
      sortOrder: url.searchParams.get("sortOrder") || undefined,
    };

    const parseResult = platformCompanyQuerySchema.safeParse(queryParams);
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

    const result = await PlatformCompanyService.listCompanies(parseResult.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ctx = await requireSuperAdmin(req);
    const body = await req.json();

    const parseResult = provisionCompanySchema.safeParse(body);
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

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await PlatformCompanyService.provisionCompany(
      parseResult.data,
      ctx.superAdmin.id,
      { ipAddress: ip, userAgent }
    );

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
