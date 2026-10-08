import { withObservability } from "@/lib/observability";
/**
 * Organization Hierarchy Tree API Route
 * GET /api/v1/organization/tree — Full hierarchy tree with counts and backward-compatible unassigned teams
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { OrganizationHierarchyService } from "@/lib/services/organization-hierarchy.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const tree = await OrganizationHierarchyService.getOrganizationTree(authContext);
    return NextResponse.json({ success: true, data: tree }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
