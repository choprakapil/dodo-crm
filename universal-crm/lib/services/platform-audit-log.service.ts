/**
 * Platform Audit Log Service (Slice 8)
 *
 * Implements an isolated, append-only audit trail for Super Admin platform operations.
 * Completely separate from tenant AuditLog.
 */

import { prisma } from "@/lib/db";
import { paginatedResponse } from "@/lib/utils/pagination";
import { Prisma } from "@prisma/client";

export interface LogPlatformActionParams {
  superAdminId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  beforeState?: Prisma.InputJsonValue;
  afterState?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PlatformAuditLogQuery {
  action?: string;
  entityType?: string;
  entityId?: string;
  superAdminId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class PlatformAuditLogService {
  /**
   * Append an immutable platform audit event.
   */
  static async logAction(params: LogPlatformActionParams) {
    return prisma.platformAuditLog.create({
      data: {
        superAdminId: params.superAdminId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        metadata: params.metadata ?? Prisma.JsonNull,
        beforeState: params.beforeState ?? Prisma.JsonNull,
        afterState: params.afterState ?? Prisma.JsonNull,
        ipAddress: params.ipAddress ? params.ipAddress.slice(0, 100) : null,
        userAgent: params.userAgent ? params.userAgent.slice(0, 500) : null,
      },
    });
  }

  /**
   * List paginated platform audit logs. Read-only.
   */
  static async listLogs(query: PlatformAuditLogQuery) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 25;
    const skip = (page - 1) * limit;

    const where: Prisma.PlatformAuditLogWhereInput = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.superAdminId) {
      where.superAdminId = query.superAdminId;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { action: { contains: term, mode: "insensitive" } },
        { entityType: { contains: term, mode: "insensitive" } },
        { entityId: { contains: term, mode: "insensitive" } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.platformAuditLog.count({ where }),
      prisma.platformAuditLog.findMany({
        where,
        include: {
          superAdmin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return paginatedResponse(logs, total, { page, pageSize: limit });
  }
}
