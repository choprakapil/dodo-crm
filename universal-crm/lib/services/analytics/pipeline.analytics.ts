import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import { ResolvedDateRange, ComparisonMetric, PipelineAnalytics, PipelineStageItem } from "./types";
import { calculateChangePercent } from "./date-range";
import { Prisma } from "@prisma/client";

/**
 * Aggregates pipeline values, stages, average deal size, won and lost amounts.
 */
export async function getPipelineAnalytics(
  ctx: AuthContext,
  range: ResolvedDateRange,
  convertedStatusIds: string[],
  lostStatusIds: string[],
  filters?: {
    teamId?: string;
    userId?: string;
    statusId?: string;
    sourceId?: string;
  }
): Promise<{
  pipelineKpi: ComparisonMetric;
  pipeline: PipelineAnalytics;
}> {
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

  // 1. Current Active Pipeline Aggregation (active leads excluding lost)
  const nonLostWhere: Prisma.LeadWhereInput =
    lostStatusIds.length > 0
      ? { statusId: { notIn: lostStatusIds } }
      : {};

  const [currentAgg, previousAgg] = await Promise.all([
    prisma.lead.aggregate({
      where: {
        ...baseWhere,
        ...nonLostWhere,
        createdAt: {
          lte: range.current.end,
        },
      },
      _sum: {
        amount: true,
      },
      _avg: {
        amount: true,
      },
      _count: {
        id: true,
      },
    }),
    prisma.lead.aggregate({
      where: {
        ...baseWhere,
        ...nonLostWhere,
        createdAt: {
          lte: range.previous.end,
        },
      },
      _sum: {
        amount: true,
      },
      _avg: {
        amount: true,
      },
      _count: {
        id: true,
      },
    }),
  ]);

  const currentTotal = Number(currentAgg._sum.amount || 0);
  const previousTotal = Number(previousAgg._sum.amount || 0);
  const avgDealValue = Number(currentAgg._avg.amount || 0);

  const pipelineKpi: ComparisonMetric = {
    current: currentTotal,
    previous: previousTotal,
    changePercent: calculateChangePercent(currentTotal, previousTotal),
  };

  // 2. Stages breakdown: Group by statusId
  const [tenantStatuses, statusGroups] = await Promise.all([
    prisma.leadStatus.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["statusId"],
      where: {
        ...baseWhere,
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    }),
  ]);

  const groupMap = new Map<
    string,
    { count: number; totalAmount: number }
  >();

  for (const group of statusGroups) {
    if (group.statusId) {
      groupMap.set(group.statusId, {
        count: group._count.id,
        totalAmount: Number(group._sum.amount || 0),
      });
    }
  }

  const stages: PipelineStageItem[] = tenantStatuses.map((s) => {
    const data = groupMap.get(s.id) || { count: 0, totalAmount: 0 };
    const percentage =
      currentTotal > 0
        ? Math.round((data.totalAmount / currentTotal) * 1000) / 10
        : 0;

    return {
      statusId: s.id,
      stageName: s.name,
      color: s.color,
      leadCount: data.count,
      totalValue: data.totalAmount,
      percentageOfPipeline: percentage,
    };
  });

  // 3. Converted and Lost Value
  let convertedValue = 0;
  let lostValue = 0;

  for (const stage of stages) {
    if (convertedStatusIds.includes(stage.statusId)) {
      convertedValue += stage.totalValue;
    }
    if (lostStatusIds.includes(stage.statusId)) {
      lostValue += stage.totalValue;
    }
  }

  const pipeline: PipelineAnalytics = {
    totalValue: currentTotal,
    avgDealValue: Math.round(avgDealValue * 100) / 100,
    stages,
    convertedValue,
    lostValue,
  };

  return {
    pipelineKpi,
    pipeline,
  };
}
