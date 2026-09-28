/**
 * Follow-up / Task Service — Phase 7 Follow-Up Lifecycle Engine
 *
 * Implements full tenant isolation, data-scope checks, lead relationship validation,
 * audit logging, timeline activity synchronization, and the Follow-Up Lifecycle Engine.
 *
 * INVARIANTS:
 * 1. ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK (type=FOLLOW_UP, status IN [PENDING, OVERDUE])
 * 2. Every Follow-Up operation enforces type = TaskType.FOLLOW_UP.
 * 3. Rescheduling updates dueAt, resets status to PENDING, and records TaskLifecycleEventType.RESCHEDULED.
 * 4. Overdue engine atomically transitions PENDING overdue FOLLOW_UP tasks to OVERDUE and appends MARKED_OVERDUE history.
 * 5. GENERAL tasks remain completely independent and untouched.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getTaskDataScopeWhere, getLeadDataScopeWhere } from "@/lib/auth/scope";
import {
  FollowUpCreateInput,
  FollowUpUpdateInput,
  FollowUpListQuery,
  FollowUpRescheduleInput,
  FollowUpCompleteInput,
  FollowUpCancelInput,
  followUpCreateSchema,
  followUpUpdateSchema,
  followUpRescheduleSchema,
  followUpCompleteSchema,
  followUpCancelSchema,
} from "@/lib/validations/follow-up";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { paginatedResponse } from "@/lib/utils/pagination";
import {
  ActivityType,
  Prisma,
  TaskLifecycleEventType,
  TaskStatus,
  TaskType,
} from "@prisma/client";

export class FollowUpService {
  /**
   * List follow-ups for the authenticated tenant with filtering, pagination, and data-scope.
   * Strictly filtered to type = TaskType.FOLLOW_UP.
   */
  static async listFollowUps(ctx: AuthContext, query: FollowUpListQuery) {
    // 1. Enforce data scope for "tasks.view" (falls back to COMPANY if admin)
    const scopeWhere = await getTaskDataScopeWhere(ctx, "view");

    const {
      page,
      limit,
      status,
      priority,
      assignedUserId,
      teamId,
      leadId,
      dueFilter,
      search,
      sortBy,
      sortOrder,
    } = query;

    // 2. Build tenant-isolated where clause scoped strictly to FOLLOW_UP
    const where: Prisma.TaskWhereInput = {
      companyId: ctx.company.id, // STRICT TENANT ISOLATION
      type: TaskType.FOLLOW_UP, // STRICT FOLLOW_UP TYPE SCOPING
      ...scopeWhere,
    };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedUserId) where.assignedUserId = assignedUserId;
    if (teamId) where.teamId = teamId;
    if (leadId) where.leadId = leadId;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (dueFilter === "today") {
      where.dueAt = { gte: startOfToday, lte: endOfToday };
      if (!status) where.status = { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] };
    } else if (dueFilter === "overdue") {
      where.OR = [
        { status: TaskStatus.OVERDUE },
        { status: TaskStatus.PENDING, dueAt: { lt: now } },
      ];
    } else if (dueFilter === "upcoming") {
      where.dueAt = { gt: endOfToday };
      where.status = TaskStatus.PENDING;
    } else if (dueFilter === "completed") {
      where.status = TaskStatus.COMPLETED;
    } else if (dueFilter === "cancelled") {
      where.status = TaskStatus.CANCELLED;
    }

    if (search && search.length > 0) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { lead: { name: { contains: search, mode: "insensitive" } } },
          ],
        },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, items] = await prisma.$transaction([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          lead: {
            select: { id: true, name: true, company: true, phone: true, email: true },
          },
          assignedUser: {
            select: { id: true, name: true, email: true },
          },
          creator: {
            select: { id: true, name: true, email: true },
          },
          completedBy: {
            select: { id: true, name: true, email: true },
          },
          team: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    return paginatedResponse(items, total, { page, pageSize: limit });
  }

  /**
   * Get single follow-up by ID with full relations, tenant isolation, and FOLLOW_UP type scoping.
   */
  static async getFollowUpById(ctx: AuthContext, id: string) {
    const scopeWhere = await getTaskDataScopeWhere(ctx, "view");

    const task = await prisma.task.findFirst({
      where: {
        id,
        companyId: ctx.company.id, // STRICT TENANT ISOLATION
        type: TaskType.FOLLOW_UP, // STRICT FOLLOW_UP TYPE SCOPING
        ...scopeWhere,
      },
      include: {
        lead: {
          select: { id: true, name: true, company: true, phone: true, email: true, deletedAt: true },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        completedBy: {
          select: { id: true, name: true, email: true },
        },
        team: {
          select: { id: true, name: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundError("Follow-up not found");
    }

    return task;
  }

  /**
   * Create a new follow-up task.
   * Enforces ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK invariant.
   */
  static async createFollowUp(ctx: AuthContext, rawInput: FollowUpCreateInput) {
    if (!ctx.hasPermission("tasks", "create") && !ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("Insufficient permissions to create follow-ups");
    }

    const parsed = followUpCreateSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || "Validation failed");
    }
    const input = parsed.data;

    // 1. If leadId provided, verify lead belongs to tenant and satisfies data scope
    let lead = null;
    if (input.leadId) {
      const leadScopeWhere = await getLeadDataScopeWhere(ctx, "view");
      lead = await prisma.lead.findFirst({
        where: {
          id: input.leadId,
          companyId: ctx.company.id,
          deletedAt: null,
          ...leadScopeWhere,
        },
      });
      if (!lead) {
        throw new ValidationError("Invalid lead for this company or insufficient permission");
      }

      // Enforce: ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK
      const activeFollowUp = await prisma.task.findFirst({
        where: {
          companyId: ctx.company.id,
          leadId: lead.id,
          type: TaskType.FOLLOW_UP,
          status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
        },
      });

      if (activeFollowUp) {
        throw new ValidationError(
          "An active follow-up already exists for this lead. Reschedule or complete the existing follow-up instead of creating a duplicate."
        );
      }
    }

    // 2. Validate assignedUserId belongs to tenant
    if (input.assignedUserId) {
      const user = await prisma.user.findFirst({
        where: {
          id: input.assignedUserId,
          companyId: ctx.company.id,
          deletedAt: null,
        },
      });
      if (!user) {
        throw new ValidationError("Invalid assigned user for this company");
      }
    }

    // 3. Validate teamId belongs to tenant
    if (input.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: input.teamId, companyId: ctx.company.id },
      });
      if (!team) {
        throw new ValidationError("Invalid team for this company");
      }
    }

    // 4. Atomically create follow-up, lifecycle history, lead timeline activity, and audit log
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const task = await tx.task.create({
        data: {
          companyId: ctx.company.id, // STRICT TENANT ISOLATION
          type: TaskType.FOLLOW_UP, // STRICT FOLLOW_UP TYPE
          leadId: lead ? lead.id : null,
          title: input.title,
          description: input.description || null,
          dueAt: input.dueAt || null,
          priority: input.priority,
          status: TaskStatus.PENDING,
          assignedUserId: input.assignedUserId || null,
          createdById: ctx.user.id,
          teamId: input.teamId || null,
        },
        include: {
          lead: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      // Record CREATED lifecycle event
      await tx.taskRescheduleHistory.create({
        data: {
          taskId: task.id,
          companyId: ctx.company.id,
          leadId: lead ? lead.id : null,
          performedById: ctx.user.id,
          eventType: TaskLifecycleEventType.CREATED,
          previousDueAt: null,
          newDueAt: task.dueAt,
          reason: "Initial follow-up scheduled",
        },
      });

      // If linked to lead, record TASK_CREATED in lead activity timeline
      if (lead) {
        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: lead.id,
            userId: ctx.user.id,
            type: ActivityType.TASK_CREATED,
            description: `Follow-up "${task.title}" scheduled by ${ctx.user.name}${
              task.dueAt ? ` (Due: ${new Date(task.dueAt).toLocaleDateString()})` : ""
            }`,
            metadata: {
              taskId: task.id,
              title: task.title,
              dueAt: task.dueAt,
              priority: task.priority,
              assignedTo: task.assignedUser?.name || null,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "FOLLOWUP_CREATED",
          entityType: "Task",
          entityId: task.id,
          metadata: {
            title: task.title,
            leadId: lead?.id,
            priority: task.priority,
            assignedUserId: task.assignedUserId,
          },
        },
      });

      return task;
    });
  }

  /**
   * Reschedule an active follow-up task.
   * Updates dueAt, sets status to PENDING, and records TaskLifecycleEventType.RESCHEDULED in history.
   */
  static async rescheduleFollowUp(
    ctx: AuthContext,
    id: string,
    rawInput: FollowUpRescheduleInput
  ) {
    if (!ctx.hasPermission("tasks", "update") && !ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("Insufficient permissions to reschedule follow-ups");
    }

    const parsed = followUpRescheduleSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message || "Validation failed");
    }
    const input = parsed.data;

    const existing = await this.getFollowUpById(ctx, id);

    if (
      existing.status !== TaskStatus.PENDING &&
      existing.status !== TaskStatus.OVERDUE
    ) {
      throw new ValidationError(
        `Cannot reschedule follow-up in status ${existing.status}. Only PENDING or OVERDUE follow-ups can be rescheduled.`
      );
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.task.update({
        where: { id: existing.id },
        data: {
          dueAt: input.dueAt,
          status: TaskStatus.PENDING,
          completedAt: null,
          completedById: null,
          cancelledAt: null,
        },
        include: {
          lead: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      // Immutable lifecycle event: RESCHEDULED
      await tx.taskRescheduleHistory.create({
        data: {
          taskId: existing.id,
          companyId: ctx.company.id,
          leadId: existing.leadId,
          performedById: ctx.user.id,
          eventType: TaskLifecycleEventType.RESCHEDULED,
          previousDueAt: existing.dueAt,
          newDueAt: input.dueAt,
          reason: input.reason || null,
          dispositionId: input.dispositionId || null,
        },
      });

      if (existing.leadId) {
        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: existing.leadId,
            userId: ctx.user.id,
            type: ActivityType.TASK_RESCHEDULED,
            description: `Follow-up "${existing.title}" rescheduled to ${new Date(
              input.dueAt
            ).toLocaleString()} by ${ctx.user.name}${input.reason ? ` (${input.reason})` : ""}`,
            metadata: {
              taskId: existing.id,
              previousDueAt: existing.dueAt,
              newDueAt: input.dueAt,
              reason: input.reason || null,
              dispositionId: input.dispositionId || null,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "FOLLOWUP_RESCHEDULED",
          entityType: "Task",
          entityId: existing.id,
          metadata: {
            previousDueAt: existing.dueAt,
            newDueAt: input.dueAt,
            reason: input.reason,
            dispositionId: input.dispositionId,
          },
        },
      });

      return updated;
    });
  }

  /**
   * Complete a follow-up task with lifecycle history.
   */
  static async completeFollowUp(
    ctx: AuthContext,
    id: string,
    rawInput?: FollowUpCompleteInput
  ) {
    if (!ctx.hasPermission("tasks", "update") && !ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("Insufficient permissions to complete follow-ups");
    }

    let input: FollowUpCompleteInput | undefined;
    if (rawInput) {
      const parsed = followUpCompleteSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message || "Validation failed");
      }
      input = parsed.data;
    }
    const existing = await this.getFollowUpById(ctx, id);

    const now = new Date();

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.task.update({
        where: { id: existing.id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: now,
          completedById: ctx.user.id,
          cancelledAt: null,
        },
        include: {
          lead: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Immutable lifecycle event: COMPLETED
      await tx.taskRescheduleHistory.create({
        data: {
          taskId: existing.id,
          companyId: ctx.company.id,
          leadId: existing.leadId,
          performedById: ctx.user.id,
          eventType: TaskLifecycleEventType.COMPLETED,
          previousDueAt: existing.dueAt,
          newDueAt: existing.dueAt,
          reason: input?.outcome || "Follow-up completed",
          dispositionId: input?.dispositionId || null,
        },
      });

      if (existing.leadId) {
        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: existing.leadId,
            userId: ctx.user.id,
            type: ActivityType.TASK_COMPLETED,
            description: `Follow-up "${existing.title}" completed by ${ctx.user.name}${
              input?.outcome ? `: ${input.outcome}` : ""
            }`,
            metadata: {
              taskId: existing.id,
              outcome: input?.outcome || null,
              dispositionId: input?.dispositionId || null,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "FOLLOWUP_COMPLETED",
          entityType: "Task",
          entityId: existing.id,
          metadata: {
            completedAt: now,
            outcome: input?.outcome,
            dispositionId: input?.dispositionId,
          },
        },
      });

      return updated;
    });
  }

  /**
   * Cancel a follow-up task with lifecycle history.
   */
  static async cancelFollowUp(
    ctx: AuthContext,
    id: string,
    rawInput?: FollowUpCancelInput
  ) {
    if (!ctx.hasPermission("tasks", "update") && !ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("Insufficient permissions to cancel follow-ups");
    }

    let input: FollowUpCancelInput | undefined;
    if (rawInput) {
      const parsed = followUpCancelSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message || "Validation failed");
      }
      input = parsed.data;
    }
    const existing = await this.getFollowUpById(ctx, id);

    const now = new Date();

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.task.update({
        where: { id: existing.id },
        data: {
          status: TaskStatus.CANCELLED,
          cancelledAt: now,
          completedAt: null,
          completedById: null,
        },
        include: {
          lead: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      });

      // Immutable lifecycle event: CANCELLED
      await tx.taskRescheduleHistory.create({
        data: {
          taskId: existing.id,
          companyId: ctx.company.id,
          leadId: existing.leadId,
          performedById: ctx.user.id,
          eventType: TaskLifecycleEventType.CANCELLED,
          previousDueAt: existing.dueAt,
          newDueAt: existing.dueAt,
          reason: input?.reason || "Follow-up cancelled",
          dispositionId: input?.dispositionId || null,
        },
      });

      if (existing.leadId) {
        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: existing.leadId,
            userId: ctx.user.id,
            type: ActivityType.TASK_CANCELLED,
            description: `Follow-up "${existing.title}" cancelled by ${ctx.user.name}${
              input?.reason ? ` (${input.reason})` : ""
            }`,
            metadata: {
              taskId: existing.id,
              reason: input?.reason || null,
              dispositionId: input?.dispositionId || null,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "FOLLOWUP_CANCELLED",
          entityType: "Task",
          entityId: existing.id,
          metadata: {
            cancelledAt: now,
            reason: input?.reason,
            dispositionId: input?.dispositionId,
          },
        },
      });

      return updated;
    });
  }

  /**
   * Cancel all active follow-ups for a given lead.
   * Used when a disposition with cancelActiveFollowUp=true is applied.
   */
  static async cancelActiveFollowUpsForLead(
    ctx: AuthContext,
    leadId: string,
    reason?: string,
    dispositionId?: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const now = new Date();

    const activeTasks = await client.task.findMany({
      where: {
        companyId: ctx.company.id,
        leadId,
        type: TaskType.FOLLOW_UP,
        status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
      },
    });

    if (activeTasks.length === 0) {
      return { cancelledCount: 0 };
    }

    for (const task of activeTasks) {
      await client.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.CANCELLED,
          cancelledAt: now,
        },
      });

      await client.taskRescheduleHistory.create({
        data: {
          taskId: task.id,
          companyId: ctx.company.id,
          leadId,
          performedById: ctx.user.id,
          eventType: TaskLifecycleEventType.CANCELLED,
          previousDueAt: task.dueAt,
          newDueAt: task.dueAt,
          reason: reason || "Cancelled by disposition rule",
          dispositionId: dispositionId || null,
        },
      });

      await client.activity.create({
        data: {
          companyId: ctx.company.id,
          leadId,
          userId: ctx.user.id,
          type: ActivityType.TASK_CANCELLED,
          description: `Follow-up "${task.title}" cancelled by disposition: ${reason || "Follow-ups cancelled"}`,
          metadata: {
            taskId: task.id,
            reason,
            dispositionId,
          },
        },
      });
    }

    return { cancelledCount: activeTasks.length };
  }

  /**
   * Atomic, idempotent overdue synchronization engine.
   * Scoped strictly to type = FOLLOW_UP.
   * GENERAL tasks are never processed.
   */
  static async syncOverdueFollowUps(companyId?: string) {
    // 1. Atomic PostgreSQL UPDATE ... RETURNING
    // Exactly one state transition, exactly one MARKED_OVERDUE history per overdue task
    const updatedTasks: Array<{
      id: string;
      companyId: string;
      leadId: string | null;
      dueAt: Date | null;
    }> = companyId
      ? await prisma.$queryRaw`
          UPDATE "tasks"
          SET "status" = 'OVERDUE'::"TaskStatus",
              "updatedAt" = NOW()
          WHERE "type" = 'FOLLOW_UP'::"TaskType"
            AND "status" = 'PENDING'::"TaskStatus"
            AND "dueAt" < NOW()
            AND "companyId" = ${companyId}
          RETURNING "id", "companyId", "leadId", "dueAt"
        `
      : await prisma.$queryRaw`
          UPDATE "tasks"
          SET "status" = 'OVERDUE'::"TaskStatus",
              "updatedAt" = NOW()
          WHERE "type" = 'FOLLOW_UP'::"TaskType"
            AND "status" = 'PENDING'::"TaskStatus"
            AND "dueAt" < NOW()
          RETURNING "id", "companyId", "leadId", "dueAt"
        `;

    // 2. For returned rows only, append MARKED_OVERDUE history
    if (updatedTasks.length > 0) {
      await prisma.taskRescheduleHistory.createMany({
        data: updatedTasks.map((task) => ({
          taskId: task.id,
          companyId: task.companyId,
          leadId: task.leadId,
          performedById: null, // System automated process
          eventType: TaskLifecycleEventType.MARKED_OVERDUE,
          previousDueAt: task.dueAt,
          newDueAt: task.dueAt,
          reason: "System automated overdue follow-up synchronization",
        })),
      });
    }

    return {
      synchronizedCount: updatedTasks.length,
      taskIds: updatedTasks.map((t) => t.id),
    };
  }

  /**
   * Get immutable lifecycle history for a follow-up task.
   */
  static async getFollowUpHistory(ctx: AuthContext, taskId: string) {
    const task = await this.getFollowUpById(ctx, taskId);

    return prisma.taskRescheduleHistory.findMany({
      where: {
        taskId: task.id,
        companyId: ctx.company.id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        performedBy: {
          select: { id: true, name: true, email: true },
        },
        disposition: {
          select: { id: true, name: true, color: true },
        },
      },
    });
  }

  /**
   * Update follow-up details, assignment, priority, or status.
   */
  static async updateFollowUp(
    ctx: AuthContext,
    id: string,
    rawInput: FollowUpUpdateInput
  ) {
    if (!ctx.hasPermission("tasks", "update") && !ctx.hasPermission("leads", "update")) {
      throw new ForbiddenError("Insufficient permissions to update follow-ups");
    }

    const input = followUpUpdateSchema.parse(rawInput);
    const existing = await this.getFollowUpById(ctx, id);

    // Validate foreign keys if changed
    if (input.leadId && input.leadId !== existing.leadId) {
      const leadScopeWhere = await getLeadDataScopeWhere(ctx, "view");
      const lead = await prisma.lead.findFirst({
        where: {
          id: input.leadId,
          companyId: ctx.company.id,
          deletedAt: null,
          ...leadScopeWhere,
        },
      });
      if (!lead) throw new ValidationError("Invalid lead for this company");
    }

    if (input.assignedUserId && input.assignedUserId !== existing.assignedUserId) {
      const user = await prisma.user.findFirst({
        where: {
          id: input.assignedUserId,
          companyId: ctx.company.id,
          deletedAt: null,
        },
      });
      if (!user) throw new ValidationError("Invalid assigned user for this company");
    }

    if (input.teamId && input.teamId !== existing.teamId) {
      const team = await prisma.team.findFirst({
        where: { id: input.teamId, companyId: ctx.company.id },
      });
      if (!team) throw new ValidationError("Invalid team for this company");
    }

    // Determine completion or cancellation transitions
    const now = new Date();
    let completedAt = existing.completedAt;
    let completedById = existing.completedById;
    let cancelledAt = existing.cancelledAt;

    if (input.status === TaskStatus.COMPLETED && existing.status !== TaskStatus.COMPLETED) {
      completedAt = now;
      completedById = ctx.user.id;
      cancelledAt = null;
    } else if (input.status === TaskStatus.CANCELLED && existing.status !== TaskStatus.CANCELLED) {
      cancelledAt = now;
      completedAt = null;
      completedById = null;
    } else if (input.status === TaskStatus.PENDING && existing.status !== TaskStatus.PENDING) {
      completedAt = null;
      completedById = null;
      cancelledAt = null;
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.task.update({
        where: { id: existing.id },
        data: {
          ...(input.title ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.priority ? { priority: input.priority } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.assignedUserId !== undefined ? { assignedUserId: input.assignedUserId || null } : {}),
          ...(input.teamId !== undefined ? { teamId: input.teamId || null } : {}),
          ...(input.leadId !== undefined ? { leadId: input.leadId || null } : {}),
          completedAt,
          completedById,
          cancelledAt,
        },
        include: {
          lead: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          completedBy: { select: { id: true, name: true, email: true } },
        },
      });

      // Record lifecycle history if status changed
      if (input.status && input.status !== existing.status) {
        let eventType: TaskLifecycleEventType = TaskLifecycleEventType.RESCHEDULED;
        if (input.status === TaskStatus.COMPLETED) {
          eventType = TaskLifecycleEventType.COMPLETED;
        } else if (input.status === TaskStatus.CANCELLED) {
          eventType = TaskLifecycleEventType.CANCELLED;
        } else if (input.status === TaskStatus.PENDING) {
          eventType = TaskLifecycleEventType.REOPENED;
        }

        await tx.taskRescheduleHistory.create({
          data: {
            taskId: existing.id,
            companyId: ctx.company.id,
            leadId: existing.leadId,
            performedById: ctx.user.id,
            eventType,
            previousDueAt: existing.dueAt,
            newDueAt: input.dueAt !== undefined ? input.dueAt : existing.dueAt,
            reason: `Status changed to ${input.status}`,
          },
        });

        // Timeline activity if linked to lead
        if (updated.leadId) {
          const activityType =
            input.status === TaskStatus.COMPLETED
              ? ActivityType.TASK_COMPLETED
              : input.status === TaskStatus.CANCELLED
              ? ActivityType.TASK_CANCELLED
              : ActivityType.TASK_UPDATED;

          await tx.activity.create({
            data: {
              companyId: ctx.company.id,
              leadId: updated.leadId,
              userId: ctx.user.id,
              type: activityType,
              description: `Follow-up "${updated.title}" marked as ${input.status} by ${ctx.user.name}`,
              metadata: {
                taskId: updated.id,
                previousStatus: existing.status,
                newStatus: input.status,
              },
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "FOLLOWUP_UPDATED",
          entityType: "Task",
          entityId: updated.id,
          metadata: {
            previousStatus: existing.status,
            newStatus: input.status || existing.status,
          },
        },
      });

      return updated;
    });
  }

  /**
   * Delete a follow-up.
   */
  static async deleteFollowUp(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("tasks", "delete") && !ctx.hasPermission("leads", "delete")) {
      throw new ForbiddenError("Insufficient permissions to delete follow-ups");
    }

    const existing = await this.getFollowUpById(ctx, id);

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.task.delete({
        where: { id: existing.id },
      });

      if (existing.leadId) {
        await tx.activity.create({
          data: {
            companyId: ctx.company.id,
            leadId: existing.leadId,
            userId: ctx.user.id,
            type: ActivityType.TASK_DELETED,
            description: `Follow-up "${existing.title}" deleted by ${ctx.user.name}`,
            metadata: {
              taskId: existing.id,
              title: existing.title,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "FOLLOWUP_DELETED",
          entityType: "Task",
          entityId: existing.id,
          metadata: {
            title: existing.title,
            leadId: existing.leadId,
          },
        },
      });

      return { success: true };
    });
  }
}
