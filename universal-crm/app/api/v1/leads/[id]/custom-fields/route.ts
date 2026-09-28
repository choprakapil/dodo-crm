import { withObservability } from "@/lib/observability";
/**
 * Lead Custom Fields API Route
 * GET   /api/v1/leads/[id]/custom-fields — Retrieve custom field values for lead
 * PATCH /api/v1/leads/[id]/custom-fields — Update custom field values for lead
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { CustomFieldService } from "@/lib/services/custom-field.service";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const data = await CustomFieldService.getLeadCustomFields(authContext, id);

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withObservability(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuth(req);
    const { id } = await params;

    const body = await req.json();
    const rawValues = body.values || body;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await CustomFieldService.saveLeadCustomFields(tx, authContext, id, rawValues);
    });

    const updatedData = await CustomFieldService.getLeadCustomFields(authContext, id);

    return NextResponse.json({ success: true, data: updatedData }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});
