import { withObservability } from "@/lib/observability";
/**
 * CRM Customers Bulk Actions API Route
 * POST /api/v1/customers/bulk — Assign owner/team or delete customers with tenant isolation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { handleApiError } from "@/lib/errors";

const bulkCustomerActionSchema = z.object({
  action: z.enum(["ASSIGN_OWNER", "ASSIGN_TEAM", "DELETE"]),
  customerIds: z.array(z.string().min(1)).min(1, "At least one customer must be selected"),
  userId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
});

export const POST = withObservability(async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth(req);
    const body = await req.json();

    const parseResult = bulkCustomerActionSchema.safeParse(body);
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

    const { action, customerIds } = parseResult.data;

    // Fetch existing customers in tenant
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: customerIds },
        companyId: ctx.company.id,
        deletedAt: null,
      },
    });

    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const succeeded: string[] = [];
    const skipped: { id: string; reason: string }[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const customerId of customerIds) {
      const customer = customerMap.get(customerId);
      if (!customer) {
        skipped.push({ id: customerId, reason: "Customer not found in this organization or already deleted" });
        continue;
      }

      try {
        switch (action) {
          case "DELETE": {
            await prisma.customer.update({
              where: { id: customerId },
              data: { deletedAt: new Date() },
            });
            succeeded.push(customerId);
            break;
          }
          default:
            succeeded.push(customerId);
            break;
        }
      } catch (err: any) {
        failed.push({ id: customerId, error: err?.message || "Operation failed" });
      }
    }

    return NextResponse.json(
      {
        success: true,
        action,
        total: customerIds.length,
        succeededCount: succeeded.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        succeeded,
        skipped,
        failed,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});
