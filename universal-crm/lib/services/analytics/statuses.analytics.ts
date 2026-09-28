import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getLeadDataScopeWhere } from "@/lib/auth/scope";
import { StatusDistributionItem } from "./types";
import { Prisma } from "@prisma/client";

/**
 * Aggregates lead distribution across tenant-configured lead statuses.
 */
export async function getStatusAnalytics(
  ctx: AuthContext,
  filters?: {
    teamId?: string;
    userId?: string;
    sourceId?: string;
  }
): Promise<StatusDistributionItem[]> {
  const scopeWhere = await getLeadDataScopeWhere(ctx, "view");

  const baseWhere: Prisma.LeadWhereInput = {
    companyId: ctx.company.id,
    deletedAt: null,
    ...scopeWhere,
    ...(filters?.teamId ? { teamId: filters.teamId } : {}),
    ...(filters?.userId ? { assignedUserId: filters.userId } : {}),
    ...(filters?.sourceId ? { sourceId: filters.sourceId } : {}),
  };

  const [tenantStatuses, groups, totalLeads] = await Promise.all([
    prisma.leadStatus.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["statusId"],
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

  for (const group of groups) {
    if (group.statusId) {
      groupMap.set(group.statusId, {
        count: group._count.id,
        totalAmount: Number(group._sum.amount || 0),
      });
    }
  }

  return tenantStatuses.map((status) => {
    const data = groupMap.get(status.id) || { count: 0, totalAmount: 0 };
    const percentage =
      totalLeads > 0
        ? Math.round((data.count / totalLeads) * 1000) / 10
        : 0;

    return {
      id: status.id,
      name: status.name,
      color: status.color,
      count: data.count,
      percentage,
      value: data.totalAmount,
    };
  });
}
