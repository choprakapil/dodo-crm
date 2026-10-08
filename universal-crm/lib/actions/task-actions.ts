"use server";

import { getAuthContext } from "@/lib/auth/session";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { TaskPriority } from "@prisma/client";

export interface TaskActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface CreateTaskInput {
  leadId?: string;
  title: string;
  description?: string;
  dueAt: string; // ISO string
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assignedUserId?: string;
}

/**
 * Server Action: Create Task / Follow-up
 */
export async function createTaskAction(
  input: CreateTaskInput
): Promise<TaskActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    if (!input.title || input.title.trim().length === 0) {
      throw new ValidationError("Task title is required");
    }

    const priorityMap: Record<string, TaskPriority> = {
      LOW: TaskPriority.LOW,
      MEDIUM: TaskPriority.MEDIUM,
      HIGH: TaskPriority.HIGH,
      URGENT: TaskPriority.URGENT,
    };

    const task = await FollowUpService.createFollowUp(authContext, {
      title: input.title.trim(),
      description: input.description?.trim(),
      dueAt: new Date(input.dueAt),
      priority: priorityMap[input.priority || "MEDIUM"] || TaskPriority.MEDIUM,
      leadId: input.leadId,
      assignedUserId: input.assignedUserId || authContext.user.id,
    });

    return {
      success: true,
      message: "Follow-up scheduled successfully",
      data: task,
    };
  } catch (err: any) {
    console.error("createTaskAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to schedule follow-up",
    };
  }
}

/**
 * Server Action: Complete Task
 */
export async function completeTaskAction(
  taskId: string,
  outcomeNotes?: string
): Promise<TaskActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const task = await FollowUpService.completeFollowUp(authContext, taskId, {
      outcome: outcomeNotes?.trim(),
    });

    return {
      success: true,
      message: "Task completed successfully",
      data: task,
    };
  } catch (err: any) {
    console.error("completeTaskAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to complete task",
    };
  }
}

/**
 * Server Action: Reschedule Task
 */
export async function rescheduleTaskAction(
  taskId: string,
  newDueAt: string,
  reason?: string
): Promise<TaskActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const task = await FollowUpService.rescheduleFollowUp(authContext, taskId, {
      dueAt: new Date(newDueAt),
      reason: reason?.trim(),
    });

    return {
      success: true,
      message: "Task rescheduled successfully",
      data: task,
    };
  } catch (err: any) {
    console.error("rescheduleTaskAction error:", err);
    return {
      success: false,
      error: err.message || "Failed to reschedule task",
    };
  }
}
