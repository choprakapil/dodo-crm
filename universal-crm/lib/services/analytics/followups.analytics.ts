import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getTaskDataScopeWhere } from "@/lib/auth/scope";
import { ResolvedDateRange, FollowUpAnalytics } from "./types";
import { TaskStatus, Prisma } from "@prisma/client";

/**
 * Aggregates follow-ups and tasks performance within date range and scope.
 */
export async function getFollowUpAnalytics(
  ctx: AuthContext,
  range: ResolvedDateRange,
  filters?: {
    teamId?: string;
    userId?: string;
  }
): Promise<{
  followUps: FollowUpAnalytics;
  dueInPeriod: number;
}> {
  const scopeWhere = await getTaskDataScopeWhere(ctx, "view");
  const now = new Date();

  const baseWhere: Prisma.TaskWhereInput = {
    companyId: ctx.company.id,
    ...scopeWhere,
    ...(filters?.teamId ? { teamId: filters.teamId } : {}),
    ...(filters?.userId ? { assignedUserId: filters.userId } : {}),
  };

  const [createdCount, completedCount, pendingCount, overdueCount, dueInPeriodCount] =
    await Promise.all([
      // Created in period
      prisma.task.count({
        where: {
          ...baseWhere,
          createdAt: {
            gte: range.current.start,
            lte: range.current.end,
          },
        },
      }),

      // Completed in period
      prisma.task.count({
        where: {
          ...baseWhere,
          status: TaskStatus.COMPLETED,
          completedAt: {
            gte: range.current.start,
            lte: range.current.end,
          },
        },
      }),

      // Active Pending
      prisma.task.count({
        where: {
          ...baseWhere,
          status: TaskStatus.PENDING,
        },
      }),

      // Overdue
      prisma.task.count({
        where: {
          ...baseWhere,
          status: TaskStatus.PENDING,
          dueAt: {
            lt: now,
          },
        },
      }),

      // Due in period
      prisma.task.count({
        where: {
          ...baseWhere,
          dueAt: {
            gte: range.current.start,
            lte: range.current.end,
          },
        },
      }),
    ]);

  const totalActionable = completedCount + pendingCount;
  const completionRate =
    totalActionable > 0
      ? Math.round((completedCount / totalActionable) * 1000) / 10
      : 0;

  return {
    followUps: {
      created: createdCount,
      completed: completedCount,
      pending: pendingCount,
      overdue: overdueCount,
      completionRate,
    },
    dueInPeriod: dueInPeriodCount,
  };
}
