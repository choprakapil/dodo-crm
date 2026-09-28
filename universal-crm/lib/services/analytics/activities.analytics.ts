import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getActivityDataScopeWhere } from "@/lib/auth/scope";
import { ResolvedDateRange, ActivityAnalytics } from "./types";
import { ActivityType, Prisma } from "@prisma/client";

/**
 * Aggregates interactions (calls, WhatsApp, emails, meetings, notes) within date range and scope.
 */
export async function getActivityAnalytics(
  ctx: AuthContext,
  range: ResolvedDateRange,
  filters?: {
    userId?: string;
  }
): Promise<ActivityAnalytics> {
  const scopeWhere = await getActivityDataScopeWhere(ctx, "view");

  const baseWhere: Prisma.ActivityWhereInput = {
    companyId: ctx.company.id,
    createdAt: {
      gte: range.current.start,
      lte: range.current.end,
    },
    ...scopeWhere,
    ...(filters?.userId ? { userId: filters.userId } : {}),
  };

  const groups = await prisma.activity.groupBy({
    by: ["type"],
    where: baseWhere,
    _count: { id: true },
  });

  const countMap: Record<ActivityType, number> = {
    CALL: 0,
    WHATSAPP: 0,
    EMAIL: 0,
    MEETING: 0,
    NOTE: 0,
    NOTE_ADDED: 0,
    NOTE_UPDATED: 0,
    NOTE_DELETED: 0,
    LEAD_CREATED: 0,
    LEAD_UPDATED: 0,
    LEAD_DELETED: 0,
    STATUS_CHANGED: 0,
    ASSIGNED: 0,
    REASSIGNED: 0,
    TASK_CREATED: 0,
    TASK_UPDATED: 0,
    TASK_COMPLETED: 0,
    TASK_CANCELLED: 0,
    TASK_DELETED: 0,
    DISPOSITION_CHANGED: 0,
    TASK_RESCHEDULED: 0,
  };

  for (const group of groups) {
    countMap[group.type] = group._count.id;
  }

  // Combine direct note activities and note system activities
  const notesTotal = countMap.NOTE + countMap.NOTE_ADDED;

  const total =
    countMap.CALL +
    countMap.WHATSAPP +
    countMap.EMAIL +
    countMap.MEETING +
    notesTotal;

  return {
    total,
    byType: {
      CALL: countMap.CALL,
      WHATSAPP: countMap.WHATSAPP,
      EMAIL: countMap.EMAIL,
      MEETING: countMap.MEETING,
      NOTE: notesTotal,
    },
  };
}
