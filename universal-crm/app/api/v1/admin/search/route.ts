import { NextRequest, NextResponse } from "next/server";
import { withObservability } from "@/lib/observability";
import { requireSuperAdmin } from "@/lib/auth/super-admin-session";
import { PlatformSearchService } from "@/lib/services/platform-search.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    const results = await PlatformSearchService.search(q);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    return handleApiError(error);
  }
});
