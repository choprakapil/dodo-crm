/**
 * Platform Dashboard Service (Slice 8)
 *
 * Provides aggregated platform-level operational telemetry for Super Admins.
 * Uses parallel, batched aggregate queries with zero N+1 database queries.
 */

import { prisma } from "@/lib/db";
import { CompanyStatus, UserStatus } from "@prisma/client";

export class PlatformDashboardService {
  /**
   * Retrieves high-level operational telemetry across all tenants.
   */
  static async getTelemetry() {
    const startTime = Date.now();

    const [
      totalCompanies,
      activeCompanies,
      suspendedCompanies,
      totalUsers,
      activeUsers,
      totalLeads,
      totalTeams,
      plansWithCounts,
      recentActivity,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.company.count({ where: { status: CompanyStatus.ACTIVE } }),
      prisma.company.count({ where: { status: CompanyStatus.SUSPENDED } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, status: UserStatus.ACTIVE } }),
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.team.count({ where: { isActive: true } }),
      prisma.plan.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          maxUsers: true,
          maxLeads: true,
          _count: {
            select: { companies: true },
          },
        },
        orderBy: { maxUsers: "asc" },
      }),
      prisma.platformAuditLog.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          superAdmin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const queryLatencyMs = Date.now() - startTime;

    return {
      metrics: {
        companies: {
          total: totalCompanies,
          active: activeCompanies,
          suspended: suspendedCompanies,
        },
        users: {
          total: totalUsers,
          active: activeUsers,
        },
        leads: {
          total: totalLeads,
        },
        teams: {
          total: totalTeams,
        },
      },
      planDistribution: plansWithCounts.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        subscriberCount: p._count.companies,
        maxUsers: p.maxUsers,
        maxLeads: p.maxLeads,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        superAdmin: a.superAdmin,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
      platformHealth: {
        status: "HEALTHY",
        database: "CONNECTED",
        latencyMs: queryLatencyMs,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
