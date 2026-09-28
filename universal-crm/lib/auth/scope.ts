/**
 * Data Scope & Authorization Helper
 *
 * Enforces OWN, TEAM, COMPANY, and PLATFORM data scopes per PRD §23 & ADR-007.
 * Avoids hardcoding role names; reads permissions directly from the server-side AuthContext.
 */

import { AuthContext } from "./session";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { Prisma, DataScope } from "@prisma/client";

/**
 * Builds Prisma `where` clause fragment enforcing the user's data scope for leads.
 */
export async function getLeadDataScopeWhere(
  ctx: AuthContext,
  action: "view" | "create" | "update" | "delete" | "assign"
): Promise<Prisma.LeadWhereInput> {
  const dataScope = ctx.getDataScope("leads", action);

  if (!dataScope) {
    throw new ForbiddenError(`Insufficient permissions for leads.${action}`);
  }

  switch (dataScope) {
    case DataScope.COMPANY:
    case DataScope.PLATFORM:
      return {};

    case DataScope.OWN:
      return {
        assignedUserId: ctx.user.id,
      };

    case DataScope.TEAM: {
      // Find all teams the user belongs to within this company
      const memberships = await prisma.teamMember.findMany({
        where: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
        },
        select: { teamId: true },
      });

      const teamIds = memberships.map((m: { teamId: string }) => m.teamId);

      return {
        OR: [
          { assignedUserId: ctx.user.id },
          ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
        ],
      };
    }

    default:
      return { assignedUserId: ctx.user.id };
  }
}

/**
 * Builds Prisma `where` clause fragment enforcing the user's data scope for tasks/follow-ups.
 */
export async function getTaskDataScopeWhere(
  ctx: AuthContext,
  action: "view" | "create" | "update" | "delete"
): Promise<Prisma.TaskWhereInput> {
  const dataScope = ctx.getDataScope("tasks", action);

  if (!dataScope) {
    throw new ForbiddenError(`Insufficient permissions for tasks.${action}`);
  }

  switch (dataScope) {
    case DataScope.COMPANY:
    case DataScope.PLATFORM:
      return {};

    case DataScope.OWN:
      return {
        OR: [
          { assignedUserId: ctx.user.id },
          { createdById: ctx.user.id },
          { lead: { assignedUserId: ctx.user.id } },
        ],
      };

    case DataScope.TEAM: {
      const memberships = await prisma.teamMember.findMany({
        where: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
        },
        select: { teamId: true },
      });

      const teamIds = memberships.map((m: { teamId: string }) => m.teamId);

      return {
        OR: [
          { assignedUserId: ctx.user.id },
          { createdById: ctx.user.id },
          ...(teamIds.length > 0
            ? [
                { teamId: { in: teamIds } },
                { lead: { teamId: { in: teamIds } } },
              ]
            : []),
        ],
      };
    }

    default:
      return { assignedUserId: ctx.user.id };
  }
}

/**
 * Resolves the effective DataScope for reports/analytics based on user permissions.
 * Falls back to "leads" data scope if "reports" or "analytics" module is not explicitly assigned.
 */
export function getReportsDataScope(
  ctx: AuthContext,
  action: "view" | "export" = "view"
): DataScope {
  const scope =
    ctx.getDataScope("reports", action) ||
    ctx.getDataScope("analytics", action) ||
    ctx.getDataScope("leads", action);

  if (!scope) {
    throw new ForbiddenError(`Insufficient permissions to ${action} reports/analytics`);
  }

  return scope;
}

/**
 * Builds Prisma `where` clause fragment enforcing the user's data scope for activities.
 */
export async function getActivityDataScopeWhere(
  ctx: AuthContext,
  action: "view" | "create" | "update" | "delete"
): Promise<Prisma.ActivityWhereInput> {
  const dataScope =
    ctx.getDataScope("activities", action) ||
    ctx.getDataScope("leads", action);

  if (!dataScope) {
    throw new ForbiddenError(`Insufficient permissions for activities.${action}`);
  }

  switch (dataScope) {
    case DataScope.COMPANY:
    case DataScope.PLATFORM:
      return {};

    case DataScope.OWN:
      return {
        OR: [
          { userId: ctx.user.id },
          { lead: { assignedUserId: ctx.user.id, deletedAt: null } },
        ],
      };

    case DataScope.TEAM: {
      const memberships = await prisma.teamMember.findMany({
        where: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
        },
        select: { teamId: true },
      });

      const teamIds = memberships.map((m: { teamId: string }) => m.teamId);

      return {
        OR: [
          { userId: ctx.user.id },
          {
            lead: {
              deletedAt: null,
              OR: [
                { assignedUserId: ctx.user.id },
                ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
              ],
            },
          },
        ],
      };
    }

    default:
      return { userId: ctx.user.id };
  }
}

