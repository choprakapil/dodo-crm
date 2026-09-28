import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import { SourceDistributionItem } from "./types";
import { Prisma } from "@prisma/client";

/**
 * Aggregates lead acquisition and pipeline values by lead source.
 */
export async function getSourceAnalytics(
  ctx: AuthContext,
  filters?: {
    teamId?: string;
    userId?: string;
    statusId?: string;
  }
): Promise<SourceDistributionItem[]> {
  const scopeWhere = await getLeadDataScopeWhere(ctx, "view");

  const baseWhere: Prisma.LeadWhereInput = {
    companyId: ctx.company.id,
    deletedAt: null,
    ...scopeWhere,
    ...(filters?.teamId ? { teamId: filters.teamId } : {}),
    ...(filters?.userId ? { assignedUserId: filters.userId } : {}),
    ...(filters?.statusId ? { statusId: filters.statusId } : {}),
  };

  const [tenantSources, groups, totalLeads] = await Promise.all([
    prisma.leadSource.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { name: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["sourceId"],
      where: baseWhere,
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.lead.count({
      where: baseWhere,
    }),
  ]);

  const groupMap = new Map<
    string,
    { count: number; totalAmount: number }
  >();

  let directCount = 0;
  let directAmount = 0;

  for (const group of groups) {
    if (group.sourceId) {
      groupMap.set(group.sourceId, {
        count: group._count.id,
        totalAmount: Number(group._sum.amount || 0),
      });
    } else {
      directCount += group._count.id;
      directAmount += Number(group._sum.amount || 0);
    }
  }

  const result: SourceDistributionItem[] = tenantSources.map((source) => {
    const data = groupMap.get(source.id) || { count: 0, totalAmount: 0 };
    const percentage =
      totalLeads > 0
        ? Math.round((data.count / totalLeads) * 1000) / 10
        : 0;

    return {
      id: source.id,
      name: source.name,
      count: data.count,
      percentage,
      value: data.totalAmount,
    };
  });

  if (directCount > 0) {
    const percentage =
      totalLeads > 0
        ? Math.round((directCount / totalLeads) * 1000) / 10
        : 0;
    result.push({
      id: "direct",
      name: "Direct / Unspecified",
      count: directCount,
      percentage,
      value: directAmount,
    });
  }

  // Sort by count descending
  return result.sort((a, b) => b.count - a.count);
}
