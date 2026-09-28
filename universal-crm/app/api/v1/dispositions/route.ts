import { withObservability } from "@/lib/observability";
/**
 * Dispositions Collection API Route — Phase 7
 * GET  /api/v1/dispositions — List dispositions (tree or flat)
 * POST /api/v1/dispositions — Create a disposition
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { DispositionService } from "@/lib/services/disposition.service";
import { dispositionCreateSchema, dispositionListQuerySchema } from "@/lib/validations/disposition";
import { handleApiError } from "@/lib/errors";

export const GET = withObservability(async function GET(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const searchParams = req.nextUrl.searchParams;
    const queryObj: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      queryObj[key] = val;
    });

    const parsedQuery = dispositionListQuerySchema.safeParse(queryObj);
    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid query parameters",
            details: parsedQuery.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { flat, includeInactive, parentId } = parsedQuery.data;

    if (flat) {
      const data = await DispositionService.listDispositions(authContext, {
        includeInactive,
        parentId,
      });
      return NextResponse.json({ success: true, data }, { status: 200 });
    }

    const tree = await DispositionService.getDispositionTree(authContext, {
      includeInactive,
    });
    return NextResponse.json({ success: true, data: tree }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const authContext = await requireAuth(req);

    const body = await req.json();
    const parseResult = dispositionCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message || "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const created = await DispositionService.createDisposition(authContext, parseResult.data);

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
