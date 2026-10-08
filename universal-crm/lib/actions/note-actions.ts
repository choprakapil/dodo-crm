"use server";

import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ValidationError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { ActivityType } from "@prisma/client";

export interface NoteActionResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

/**
 * Server Action: Add Note to Lead / Deal
 *
 * Enforces:
 * 1. Multi-tenant row isolation via AuthContext
 * 2. RBAC check (notes.create or leads.update or Admin)
 * 3. Persists Note entity in DB with author attribution
 * 4. Records ActivityType.NOTE_ADDED in activity timeline
 * 5. Updates lead timestamp
 */
export async function addNoteToLead(
  leadId: string,
  content: string
): Promise<NoteActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const trimmed = content?.trim();
    if (!trimmed || trimmed.length < 2) {
      throw new ValidationError("Note content must be at least 2 characters long");
    }

    const companyId = authContext.company.id;

    // Check authorization
    const canNote =
      authContext.role.name === "Admin" ||
      authContext.hasPermission("notes", "create") ||
      authContext.hasPermission("leads", "update");

    if (!canNote) {
      throw new ForbiddenError("Permission denied: You do not have permission to add notes");
    }

    // Verify lead exists and belongs to company
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        companyId,
        deletedAt: null,
      },
    });

    if (!lead) {
      throw new NotFoundError("Lead record not found in tenant organization");
    }

    // 1. Create Note
    const note = await prisma.note.create({
      data: {
        companyId,
        leadId,
        userId: authContext.user.id,
        content: trimmed,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 2. Record Activity in timeline
    await prisma.activity.create({
      data: {
        companyId,
        leadId,
        userId: authContext.user.id,
        type: ActivityType.NOTE_ADDED,
        description: `Note added: "${trimmed.length > 60 ? trimmed.slice(0, 57) + "..." : trimmed}"`,
        metadata: {
          noteId: note.id,
          snippet: trimmed.slice(0, 100),
          authorName: authContext.user.name,
        },
      },
    });

    // 3. Touch lead updatedAt
    await prisma.lead.update({
      where: { id: leadId },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      message: "Note added successfully",
      data: note,
    };
  } catch (err: any) {
    console.error("addNoteToLead error:", err);
    return {
      success: false,
      error: err.message || "Failed to add note",
    };
  }
}

/**
 * Server Action: Fetch notes for a lead
 */
export async function getLeadNotes(leadId: string): Promise<NoteActionResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;

    const notes = await prisma.note.findMany({
      where: {
        leadId,
        companyId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      data: notes,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to fetch notes",
    };
  }
}
