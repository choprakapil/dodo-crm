import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import { ResolvedDateRange, ComparisonMetric, LeadTrendPoint, LeadVelocityAnalytics } from "./types";
import { calculateChangePercent } from "./date-range";
import { Prisma } from "@prisma/client";

/**
 * Aggregates lead KPIs, creation trends, and conversion velocity within tenant & data scope.
 */
export async function getLeadsAnalytics(
  ctx: AuthContext,
  range: ResolvedDateRange,
  convertedStatusIds: string[],
  filters?: {
    teamId?: string;
    userId?: string;
    statusId?: string;
    sourceId?: string;
  }
) {
  const scopeWhere = await getLeadDataScopeWhere(ctx, "view");

  const baseWhere: Prisma.LeadWhereInput = {
    companyId: ctx.company.id,
    deletedAt: null,
    ...scopeWhere,
    ...(filters?.teamId ? { teamId: filters.teamId } : {}),
    ...(filters?.userId ? { assignedUserId: filters.userId } : {}),
    ...(filters?.statusId ? { statusId: filters.statusId } : {}),
    ...(filters?.sourceId ? { sourceId: filters.sourceId } : {}),
  };

  // 1. Total Accessible Active Leads
  const totalLeads = await prisma.lead.count({
    where: baseWhere,
  });

  // 2. New Leads in Current vs Previous Period
  const [currentNewLeads, previousNewLeads] = await Promise.all([
    prisma.lead.count({
      where: {
        ...baseWhere,
        createdAt: {
          gte: range.current.start,
          lte: range.current.end,
        },
      },
    }),
    prisma.lead.count({
      where: {
        ...baseWhere,
        createdAt: {
          gte: range.previous.start,
          lte: range.previous.end,
        },
      },
    }),
  ]);

  const newLeadsMetric: ComparisonMetric = {
    current: currentNewLeads,
    previous: previousNewLeads,
    changePercent: calculateChangePercent(currentNewLeads, previousNewLeads),
  };

  // 3. Converted Leads in Current vs Previous Period
  const convertedWhere: Prisma.LeadWhereInput =
    convertedStatusIds.length > 0
      ? { statusId: { in: convertedStatusIds } }
      : { id: "__NO_CONVERTED_STATUSES__" };

  const [currentConverted, previousConverted] = await Promise.all([
    prisma.lead.count({
      where: {
        ...baseWhere,
        ...convertedWhere,
        updatedAt: {
          gte: range.current.start,
          lte: range.current.end,
        },
      },
    }),
    prisma.lead.count({
      where: {
        ...baseWhere,
        ...convertedWhere,
        updatedAt: {
          gte: range.previous.start,
          lte: range.previous.end,
        },
      },
    }),
  ]);

  const convertedLeadsMetric: ComparisonMetric = {
    current: currentConverted,
    previous: previousConverted,
    changePercent: calculateChangePercent(currentConverted, previousConverted),
  };

  // 4. Conversion Rate
  const currentRate =
    currentNewLeads > 0
      ? Math.round((currentConverted / currentNewLeads) * 1000) / 10
      : 0;
  const previousRate =
    previousNewLeads > 0
      ? Math.round((previousConverted / previousNewLeads) * 1000) / 10
      : 0;

  const conversionRateMetric: ComparisonMetric = {
    current: currentRate,
    previous: previousRate,
    changePercent: calculateChangePercent(currentRate, previousRate),
  };

  // 5. Time Series Trend: Leads Created Over Time
  const leadsInPeriod = await prisma.lead.findMany({
    where: {
      ...baseWhere,
      createdAt: {
        gte: range.current.start,
        lte: range.current.end,
      },
    },
    select: {
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const durationDays = Math.max(
    1,
    Math.ceil(
      (range.current.end.getTime() - range.current.start.getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const bucketMap = new Map<string, number>();

  // Determine granularity based on range duration
  const granularity = durationDays <= 31 ? "day" : durationDays <= 90 ? "week" : "month";

  // Pre-fill buckets so there are no empty gaps in charts
  const cursor = new Date(range.current.start);
  while (cursor <= range.current.end) {
    let key: string;
    if (granularity === "day") {
      key = cursor.toISOString().slice(0, 10);
      cursor.setDate(cursor.getDate() + 1);
    } else if (granularity === "week") {
      // Start of week key (YYYY-Www or YYYY-MM-DD)
      key = cursor.toISOString().slice(0, 10);
      cursor.setDate(cursor.getDate() + 7);
    } else {
      key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      cursor.setMonth(cursor.getMonth() + 1);
    }
    bucketMap.set(key, 0);
  }

  // Populate actual counts
  for (const lead of leadsInPeriod) {
    let key: string;
    if (granularity === "day") {
      key = lead.createdAt.toISOString().slice(0, 10);
    } else if (granularity === "week") {
      // Find nearest prior week bucket
      const d = new Date(lead.createdAt);
      d.setHours(0, 0, 0, 0);
      key = d.toISOString().slice(0, 10);
      // find existing matching key or fallback
      let matchedKey = key;
      for (const bucketKey of bucketMap.keys()) {
        if (bucketKey <= key) {
          matchedKey = bucketKey;
        }
      }
      key = matchedKey;
    } else {
      key = `${lead.createdAt.getFullYear()}-${String(lead.createdAt.getMonth() + 1).padStart(2, "0")}`;
    }

    bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
  }

  const trends: LeadTrendPoint[] = Array.from(bucketMap.entries()).map(
    ([date, count]) => {
      let label = date;
      if (date.length === 10) {
        const d = new Date(date);
        label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else if (date.length === 7) {
        const [year, month] = date.split("-");
        const d = new Date(parseInt(year), parseInt(month) - 1, 1);
        label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      }
      return {
        date,
        label,
        leads: count,
      };
    }
  );

  // 6. Lead Velocity: Leads per day/week and average time to conversion
  const leadsPerDay = Math.round((currentNewLeads / durationDays) * 10) / 10;
  const leadsPerWeek = Math.round(leadsPerDay * 7 * 10) / 10;

  // Calculate average days to convert from LeadStatusHistory if converted status transitions exist
  let avgDaysToConvert: number | null = null;
  if (convertedStatusIds.length > 0) {
    const transitions = await prisma.leadStatusHistory.findMany({
      where: {
        companyId: ctx.company.id,
        toStatusId: { in: convertedStatusIds },
        changedAt: {
          gte: range.current.start,
          lte: range.current.end,
        },
        lead: {
          ...scopeWhere,
        },
      },
      include: {
        lead: {
          select: {
            createdAt: true,
          },
        },
      },
    });

    if (transitions.length > 0) {
      const totalDiffMs = transitions.reduce((acc, t) => {
        const diff = t.changedAt.getTime() - t.lead.createdAt.getTime();
        return acc + Math.max(0, diff);
      }, 0);
      const avgMs = totalDiffMs / transitions.length;
      avgDaysToConvert = Math.round((avgMs / (1000 * 60 * 60 * 24)) * 10) / 10;
    }
  }

  const velocity: LeadVelocityAnalytics = {
    leadsPerDay,
    leadsPerWeek,
    avgDaysToConvert,
  };

  return {
    totalLeads,
    newLeads: newLeadsMetric,
    convertedLeads: convertedLeadsMetric,
    conversionRate: conversionRateMetric,
    trends,
    velocity,
  };
}
