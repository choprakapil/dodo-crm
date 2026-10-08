"use server";

import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export interface NotificationActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  deepLink: string;
  readAt: Date | null;
  createdAt: Date;
  actor?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

/**
 * Server Action: Get recent notifications for the logged-in user
 * Tenant isolation: strictly filtered by session.companyId AND session.user.id
 */
export async function getNotifications(
  limit = 30
): Promise<{ success: boolean; data?: NotificationItem[]; error?: string }> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;
    const userId = authContext.user.id;

    const notifications = await prisma.notification.findMany({
      where: {
        companyId,
        userId,
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: Math.min(Math.max(limit, 1), 100),
    });

    return {
      success: true,
      data: notifications,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to retrieve notifications",
    };
  }
}

/**
 * Server Action: Get unread notification count for badge display
 * Indexed lookup: [companyId, userId, readAt]
 */
export async function getUnreadNotificationCount(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      return { success: true, count: 0 };
    }

    const companyId = authContext.company.id;
    const userId = authContext.user.id;

    const count = await prisma.notification.count({
      where: {
        companyId,
        userId,
        readAt: null,
      },
    });

    return {
      success: true,
      count,
    };
  } catch (err: any) {
    return {
      success: false,
      count: 0,
      error: err.message || "Failed to get unread notification count",
    };
  }
}

/**
 * Server Action: Mark a single notification as read
 * Strictly enforces tenant isolation (companyId + userId)
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<NotificationActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;
    const userId = authContext.user.id;

    const existing = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        companyId,
        userId,
      },
    });

    if (!existing) {
      throw new NotFoundError("Notification not found");
    }

    if (!existing.readAt) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }

    return {
      success: true,
      message: "Notification marked as read",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to mark notification as read",
    };
  }
}

/**
 * Server Action: Mark all notifications as read for current user
 */
export async function markAllNotificationsAsRead(): Promise<NotificationActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;
    const userId = authContext.user.id;

    const result = await prisma.notification.updateMany({
      where: {
        companyId,
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      success: true,
      message: `Marked ${result.count} notifications as read`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to mark all notifications as read",
    };
  }
}

/**
 * Server-side helper: Create a high-value operational notification
 * Enforces:
 * - Anti-spam rule: Self-actions never generate a notification for the actor
 * - Anti-spam coalescing: duplicate notifications in 60s suppressed
 */
export async function createOperationalNotification(params: {
  companyId: string;
  userId: string;
  actorId?: string | null;
  type: "ASSIGNMENT" | "TASK_DUE" | "TASK_OVERDUE" | "MENTION" | "DEAL_STAGE" | "COMMENT" | "SYSTEM";
  title: string;
  message: string;
  entityType?: "LEAD" | "CUSTOMER" | "DEAL" | "TASK" | null;
  entityId?: string | null;
  deepLink: string;
}): Promise<NotificationActionResult> {
  try {
    const { companyId, userId, actorId, type, title, message, entityType, entityId, deepLink } =
      params;

    // Guard 1: Do not notify oneself
    if (actorId && actorId === userId) {
      return { success: true, message: "Self-notification suppressed" };
    }

    // Guard 2: Coalesce rapid duplicate notifications (within 60s)
    const recentDuplicate = await prisma.notification.findFirst({
      where: {
        companyId,
        userId,
        type,
        entityId: entityId || undefined,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000),
        },
      },
    });

    if (recentDuplicate) {
      return { success: true, message: "Duplicate notification coalesced" };
    }

    const created = await prisma.notification.create({
      data: {
        companyId,
        userId,
        actorId: actorId || null,
        type,
        title,
        message,
        entityType: entityType || null,
        entityId: entityId || null,
        deepLink,
      },
    });

    return {
      success: true,
      data: created,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create notification",
    };
  }
}
