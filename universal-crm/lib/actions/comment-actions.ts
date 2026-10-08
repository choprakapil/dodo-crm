"use server";

import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { ActivityType } from "@prisma/client";
import { createOperationalNotification } from "./notification-actions";

export interface CommentActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface CommentItem {
  id: string;
  entityType: string;
  entityId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  author: {
    id: string;
    name: string;
    email: string;
  };
  mentions: {
    id: string;
    mentionedUser: {
      id: string;
      name: string;
    };
  }[];
  canEdit: boolean;
  canDelete: boolean;
  isEdited: boolean;
}

const MENTION_TOKEN_REGEX = /@\[([^\]]+)\]\(user:([a-zA-Z0-9_-]+)\)/g;

function sanitizeCommentContent(raw: string): string {
  // Strip dangerous html script / iframe tags
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .trim();
}

/**
 * Server Action: Get all comments for an entity (Lead, Customer, Deal)
 * Scoped strictly to companyId
 */
export async function getComments(
  entityType: "LEAD" | "CUSTOMER" | "DEAL" | "TASK",
  entityId: string
): Promise<{ success: boolean; data?: CommentItem[]; error?: string }> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;
    const currentUserId = authContext.user.id;
    const isAdmin = authContext.role.name === "Admin";
    const canManage = authContext.hasPermission("leads", "manage");

    const comments = await prisma.comment.findMany({
      where: {
        companyId,
        entityType,
        entityId,
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const now = Date.now();
    const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes

    const mapped: CommentItem[] = comments.map((c) => {
      const isAuthor = c.authorId === currentUserId;
      const withinGracePeriod = now - c.createdAt.getTime() <= GRACE_PERIOD_MS;
      const isEdited = c.updatedAt.getTime() - c.createdAt.getTime() > 1000;

      return {
        id: c.id,
        entityType: c.entityType,
        entityId: c.entityId,
        authorId: c.authorId,
        content: c.content,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        deletedAt: c.deletedAt,
        author: c.author,
        mentions: c.mentions,
        canEdit: isAuthor && withinGracePeriod,
        canDelete: (isAuthor && withinGracePeriod) || isAdmin || canManage,
        isEdited,
      };
    });

    return {
      success: true,
      data: mapped,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load comments",
    };
  }
}

/**
 * Server Action: Post a new internal comment with @mention extraction
 */
export async function createComment(params: {
  entityType: "LEAD" | "CUSTOMER" | "DEAL" | "TASK";
  entityId: string;
  content: string;
}): Promise<CommentActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const { entityType, entityId, content } = params;
    const cleanContent = sanitizeCommentContent(content);

    if (!cleanContent || cleanContent.length < 1) {
      throw new ValidationError("Comment cannot be empty");
    }

    const companyId = authContext.company.id;
    const authorId = authContext.user.id;
    const authorName = authContext.user.name;

    // 1. Verify entity existence and resolve record name for notification
    let recordTitle = `${entityType} record`;
    let deepLink = `/app/leads/${entityId}`;

    if (entityType === "LEAD") {
      const lead = await prisma.lead.findFirst({
        where: { id: entityId, companyId, deletedAt: null },
      });
      if (!lead) throw new NotFoundError("Lead record not found");
      recordTitle = lead.name || "Lead";
      deepLink = `/app/leads/${entityId}`;
    } else if (entityType === "CUSTOMER") {
      const customer = await prisma.customer.findFirst({
        where: { id: entityId, companyId, deletedAt: null },
      });
      if (!customer) throw new NotFoundError("Customer record not found");
      recordTitle = customer.name || "Customer";
      deepLink = `/app/customers`;
    }

    // 2. Parse mention tokens: @[Name](user:id)
    const mentionedUserIds = new Set<string>();
    let match;
    const regex = new RegExp(MENTION_TOKEN_REGEX);
    while ((match = regex.exec(cleanContent)) !== null) {
      const userId = match[2];
      if (userId && userId !== authorId) {
        mentionedUserIds.add(userId);
      }
    }

    // 3. Security check: Validate mentioned users strictly belong to same company & are ACTIVE
    const validMentionedUsers =
      mentionedUserIds.size > 0
        ? await prisma.user.findMany({
            where: {
              id: { in: Array.from(mentionedUserIds) },
              companyId,
              status: "ACTIVE",
              deletedAt: null,
            },
            select: { id: true, name: true },
          })
        : [];

    // 4. Create comment and junction mentions in a transaction
    const comment = await prisma.$transaction(async (tx) => {
      const newComment = await tx.comment.create({
        data: {
          companyId,
          entityType,
          entityId,
          authorId,
          content: cleanContent,
        },
      });

      if (validMentionedUsers.length > 0) {
        await tx.commentMention.createMany({
          data: validMentionedUsers.map((u) => ({
            companyId,
            commentId: newComment.id,
            mentionedUserId: u.id,
          })),
        });
      }

      // 5. Mirror to Activity timeline if it's a Lead
      if (entityType === "LEAD") {
        await tx.activity.create({
          data: {
            companyId,
            leadId: entityId,
            userId: authorId,
            type: ActivityType.NOTE,
            description: `💬 Team comment: ${cleanContent.replace(MENTION_TOKEN_REGEX, "@$1")}`,
            metadata: {
              commentId: newComment.id,
              authorName,
              isTeamComment: true,
            },
          },
        });
      }

      return newComment;
    });

    // 6. Dispatch in-app notifications for each mentioned user
    for (const mentioned of validMentionedUsers) {
      await createOperationalNotification({
        companyId,
        userId: mentioned.id,
        actorId: authorId,
        type: "MENTION",
        title: "Mentioned in comment",
        message: `${authorName} mentioned you on ${recordTitle}: "${cleanContent.replace(MENTION_TOKEN_REGEX, "@$1").slice(0, 60)}"`,
        entityType,
        entityId,
        deepLink,
      });
    }

    return {
      success: true,
      data: comment,
      message: "Comment posted successfully",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to post comment",
    };
  }
}

/**
 * Server Action: Edit an existing comment within the 15-minute grace period
 */
export async function editComment(
  commentId: string,
  newContent: string
): Promise<CommentActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const cleanContent = sanitizeCommentContent(newContent);
    if (!cleanContent || cleanContent.length < 1) {
      throw new ValidationError("Comment cannot be empty");
    }

    const companyId = authContext.company.id;
    const userId = authContext.user.id;

    const existing = await prisma.comment.findFirst({
      where: {
        id: commentId,
        companyId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("Comment not found");
    }

    // Only author can edit
    if (existing.authorId !== userId) {
      throw new ForbiddenError("You can only edit your own comments");
    }

    // Strict 15-minute grace period enforcement
    const now = Date.now();
    const GRACE_PERIOD_MS = 15 * 60 * 1000;
    if (now - existing.createdAt.getTime() > GRACE_PERIOD_MS) {
      throw new ValidationError("Comment edit window (15 minutes) has expired");
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: cleanContent,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: updated,
      message: "Comment updated successfully",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to update comment",
    };
  }
}

/**
 * Server Action: Soft delete comment
 * Permitted for author (within grace period) or Admin / leads:manage
 */
export async function deleteComment(commentId: string): Promise<CommentActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;
    const userId = authContext.user.id;
    const isAdmin = authContext.role.name === "Admin";
    const canManage = authContext.hasPermission("leads", "manage");

    const existing = await prisma.comment.findFirst({
      where: {
        id: commentId,
        companyId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundError("Comment not found");
    }

    const isAuthor = existing.authorId === userId;
    const withinGracePeriod = Date.now() - existing.createdAt.getTime() <= 15 * 60 * 1000;

    if (!((isAuthor && withinGracePeriod) || isAdmin || canManage)) {
      throw new ForbiddenError("You do not have permission to delete this comment");
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message: "Comment deleted",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to delete comment",
    };
  }
}

/**
 * Server Action: Get active team members for @mention autocomplete
 * Tenant-scoped strictly to companyId
 */
export async function getTeamMembersForMention(): Promise<{
  success: boolean;
  data?: { id: string; name: string; email: string }[];
  error?: string;
}> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;

    const users = await prisma.user.findMany({
      where: {
        companyId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
      take: 50,
    });

    return {
      success: true,
      data: users,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load team members",
    };
  }
}
