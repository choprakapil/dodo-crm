/**
 * Audit Log Viewer Service
 *
 * Implements read-only, tamper-proof audit log exploration with
 * strict tenant isolation and composite filtering.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import { Prisma } from "@prisma/client";

export interface AuditLogQuery {
  action?: string;
  entityType?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class AuditLogService {
  /**
   * List paginated audit logs for tenant.
   */
  static async listAuditLogs(ctx: AuthContext, query: AuditLogQuery) {
    const canView =
      ctx.hasPermission("audit_logs", "view") ||
      ctx.hasPermission("settings", "manage") ||
      ctx.role.name === "Admin";

    if (!canView) {
      throw new ForbiddenError("Permission denied: audit_logs.view required");
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 25;

    const where: Prisma.AuditLogWhereInput = {
      companyId: ctx.company.id, // STRICT TENANT ISOLATION
    };

    if (query.action) {
      where.action = query.action;
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { action: { contains: term, mode: "insensitive" } },
        { entityType: { contains: term, mode: "insensitive" } },
        { entityId: { contains: term, mode: "insensitive" } },
        { user: { name: { contains: term, mode: "insensitive" } } },
        { user: { email: { contains: term, mode: "insensitive" } } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt,
      actor: log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            email: log.user.email,
          }
        : {
            id: null,
            name: "System",
            email: null,
          },
    }));

    return paginatedResponse(formattedLogs, total, { page, pageSize: limit });
  }
}
