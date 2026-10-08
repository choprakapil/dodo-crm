import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformUserService } from "@/lib/services/platform-user.service";
import { handleApiError } from "@/lib/errors";
import { UserStatus } from "@prisma/client";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const { searchParams } = new URL(req.url);

    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
    const search = searchParams.get("search") || undefined;
    const companyId = searchParams.get("companyId") || undefined;
    const roleId = searchParams.get("roleId") || undefined;
    const status = (searchParams.get("status") as UserStatus) || undefined;
    const sortBy = (searchParams.get("sortBy") as any) || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") as any) || "desc";

    const result = await PlatformUserService.listGlobalUsers({
      page,
      limit,
      search,
      companyId,
      roleId,
      status,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
});
