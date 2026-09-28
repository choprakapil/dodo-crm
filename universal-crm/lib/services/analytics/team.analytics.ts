import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getReportsDataScope } from "@/lib/auth/scope";
import { ResolvedDateRange, TeamMemberPerformance } from "./types";
import { ActivityType, DataScope, TaskStatus, UserStatus } from "@prisma/client";

/**
 * Aggregates team & agent performance leaderboard strictly within authenticated data scope.
 * Uses batched database aggregations (groupBy) to avoid N+1 queries.
 */
export async function getTeamAnalytics(
  ctx: AuthContext,
  range: ResolvedDateRange,
  convertedStatusIds: string[],
  filters?: {
    teamId?: string;
    userId?: string;
  }
): Promise<TeamMemberPerformance[]> {
  const scope = getReportsDataScope(ctx, "view");
  const now = new Date();

  // 1. Identify accessible users based on caller's data scope
  const userWhere: Record<string, unknown> = {
    companyId: ctx.company.id,
    status: UserStatus.ACTIVE,
    deletedAt: null,
  };

  if (scope === DataScope.OWN) {
    userWhere.id = ctx.user.id;
  } else if (scope === DataScope.TEAM) {
    const memberships = await prisma.teamMember.findMany({
      where: {
        companyId: ctx.company.id,
        userId: ctx.user.id,
      },
      select: { teamId: true },
    });

    const teamIds = memberships.map((m) => m.teamId);

    // If caller filtered by a specific team, ensure they belong to it
    const effectiveTeamIds = filters?.teamId
      ? teamIds.filter((id) => id === filters.teamId)
      : teamIds;

    const teamUserMemberships = await prisma.teamMember.findMany({
      where: {
        companyId: ctx.company.id,
        teamId: { in: effectiveTeamIds },
      },
      select: { userId: true },
    });

    const allowedUserIds = Array.from(
      new Set([ctx.user.id, ...teamUserMemberships.map((m) => m.userId)])
    );

    userWhere.id = { in: allowedUserIds };
  } else {
    // COMPANY or PLATFORM scope
    if (filters?.teamId) {
      const teamUserMemberships = await prisma.teamMember.findMany({
        where: {
          companyId: ctx.company.id,
          teamId: filters.teamId,
        },
        select: { userId: true },
      });
      userWhere.id = { in: teamUserMemberships.map((m) => m.userId) };
    }
  }

  if (filters?.userId) {
    // If specific user filter provided, ensure it does not bypass scope
    if (scope === DataScope.OWN && filters.userId !== ctx.user.id) {
      return [];
    }
    userWhere.id = filters.userId;
  }

  // Fetch permitted users
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      role: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  if (users.length === 0) {
    return [];
  }

  const userIds = users.map((u) => u.id);

  // 2. Batched Parallel Aggregations
  const [
    leadsTotalGroups,
    leadsNewGroups,
    leadsConvertedGroups,
    tasksCompletedGroups,
    tasksOverdueGroups,
    activitiesGroups,
  ] = await Promise.all([
    // Total assigned leads + pipeline value
    prisma.lead.groupBy({
      by: ["assignedUserId"],
      where: {
        companyId: ctx.company.id,
        deletedAt: null,
        assignedUserId: { in: userIds },
      },
      _count: { id: true },
      _sum: { amount: true },
    }),

    // New leads created in period
    prisma.lead.groupBy({
      by: ["assignedUserId"],
      where: {
        companyId: ctx.company.id,
        deletedAt: null,
        assignedUserId: { in: userIds },
        createdAt: {
          gte: range.current.start,
          lte: range.current.end,
        },
      },
      _count: { id: true },
    }),

    // Converted leads
    convertedStatusIds.length > 0
      ? prisma.lead.groupBy({
          by: ["assignedUserId"],
          where: {
            companyId: ctx.company.id,
            deletedAt: null,
            assignedUserId: { in: userIds },
            statusId: { in: convertedStatusIds },
          },
          _count: { id: true },
        })
      : Promise.resolve([]),

    // Completed follow-ups in period (by completedById or assignedUserId)
    prisma.task.groupBy({
      by: ["assignedUserId"],
      where: {
        companyId: ctx.company.id,
        assignedUserId: { in: userIds },
        status: TaskStatus.COMPLETED,
        completedAt: {
          gte: range.current.start,
          lte: range.current.end,
        },
      },
      _count: { id: true },
    }),

    // Overdue follow-ups
    prisma.task.groupBy({
      by: ["assignedUserId"],
      where: {
        companyId: ctx.company.id,
        assignedUserId: { in: userIds },
        status: TaskStatus.PENDING,
        dueAt: {
          lt: now,
        },
      },
      _count: { id: true },
    }),

    // Activities in period by user and type
    prisma.activity.groupBy({
      by: ["userId", "type"],
      where: {
        companyId: ctx.company.id,
        userId: { in: userIds },
        createdAt: {
          gte: range.current.start,
          lte: range.current.end,
        },
      },
      _count: { id: true },
    }),
  ]);

  // Index aggregation results for O(1) retrieval
  const totalLeadsMap = new Map<string, { count: number; value: number }>();
  for (const g of leadsTotalGroups) {
    if (g.assignedUserId) {
      totalLeadsMap.set(g.assignedUserId, {
        count: g._count.id,
        value: Number(g._sum.amount || 0),
      });
    }
  }

  const newLeadsMap = new Map<string, number>();
  for (const g of leadsNewGroups) {
    if (g.assignedUserId) {
      newLeadsMap.set(g.assignedUserId, g._count.id);
    }
  }

  const convertedLeadsMap = new Map<string, number>();
  for (const g of leadsConvertedGroups) {
    if (g.assignedUserId) {
      convertedLeadsMap.set(g.assignedUserId, g._count.id);
    }
  }

  const completedTasksMap = new Map<string, number>();
  for (const g of tasksCompletedGroups) {
    if (g.assignedUserId) {
      completedTasksMap.set(g.assignedUserId, g._count.id);
    }
  }

  const overdueTasksMap = new Map<string, number>();
  for (const g of tasksOverdueGroups) {
    if (g.assignedUserId) {
      overdueTasksMap.set(g.assignedUserId, g._count.id);
    }
  }

  const activityMap = new Map<
    string,
    { total: number; calls: number; whatsApp: number; emails: number; meetings: number }
  >();

  for (const g of activitiesGroups) {
    if (!g.userId) continue;
    const current = activityMap.get(g.userId) || {
      total: 0,
      calls: 0,
      whatsApp: 0,
      emails: 0,
      meetings: 0,
    };

    const count = g._count.id;
    if (g.type === ActivityType.CALL) current.calls += count;
    else if (g.type === ActivityType.WHATSAPP) current.whatsApp += count;
    else if (g.type === ActivityType.EMAIL) current.emails += count;
    else if (g.type === ActivityType.MEETING) current.meetings += count;

    current.total += count;
    activityMap.set(g.userId, current);
  }

  // 3. Assemble and rank team performance
  const performanceList: TeamMemberPerformance[] = users.map((user) => {
    const leadStats = totalLeadsMap.get(user.id) || { count: 0, value: 0 };
    const newLeads = newLeadsMap.get(user.id) || 0;
    const converted = convertedLeadsMap.get(user.id) || 0;
    const conversionRate =
      leadStats.count > 0
        ? Math.round((converted / leadStats.count) * 1000) / 10
        : 0;

    const completedFollowUps = completedTasksMap.get(user.id) || 0;
    const overdueFollowUps = overdueTasksMap.get(user.id) || 0;
    const actStats = activityMap.get(user.id) || {
      total: 0,
      calls: 0,
      whatsApp: 0,
      emails: 0,
      meetings: 0,
    };

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      roleName: user.role?.name || "Agent",
      assignedLeads: leadStats.count,
      newLeads,
      convertedLeads: converted,
      conversionRate,
      pipelineValue: leadStats.value,
      completedFollowUps,
      overdueFollowUps,
      activitiesCount: actStats.total,
      calls: actStats.calls,
      whatsApp: actStats.whatsApp,
      emails: actStats.emails,
      meetings: actStats.meetings,
    };
  });

  // Sort by pipeline value descending, then assigned leads
  return performanceList.sort((a, b) => {
    if (b.pipelineValue !== a.pipelineValue) {
      return b.pipelineValue - a.pipelineValue;
    }
    return b.assignedLeads - a.assignedLeads;
  });
}
