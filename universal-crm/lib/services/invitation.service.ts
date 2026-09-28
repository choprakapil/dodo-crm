/**
 * User Invitation Service
 *
 * Handles single-use, time-limited (7-day) invitation tokens,
 * tenant isolation, onboarding password setup, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext, createDbSession } from "@/lib/auth/session";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { generateSecureToken, hashToken } from "@/lib/utils/tokens";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { EmailTemplates } from "@/lib/services/email";
import { getAppUrl } from "@/lib/config";
import { InviteUserInput, AcceptInvitationInput } from "@/lib/validations/invitation";
import { UserStatus } from "@prisma/client";

export class InvitationService {
  /**
   * Invite a new user to the tenant company.
   */
  static async createInvitation(ctx: AuthContext, input: InviteUserInput) {
    if (!ctx.hasPermission("users", "manage")) {
      throw new ForbiddenError("Permission denied: users.manage required");
    }

    const { email, roleId, teamId, name } = input;

    // 1. Verify role belongs to tenant
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        companyId: ctx.company.id,
      },
    });

    if (!role) {
      throw new ValidationError("Invalid role for this company");
    }

    // 2. Verify team belongs to tenant if specified
    if (teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          companyId: ctx.company.id,
        },
      });

      if (!team) {
        throw new ValidationError("Invalid team for this company");
      }
    }

    // 3. Check if active user already exists
    const existingUser = await prisma.user.findUnique({
      where: {
        companyId_email: {
          companyId: ctx.company.id,
          email,
        },
      },
    });

    if (existingUser && existingUser.deletedAt === null && existingUser.status === UserStatus.ACTIVE) {
      throw new ValidationError("A user with this email already exists and is active in this company");
    }

    // 4. Generate 32-byte secure random token
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { invitation, user } = await prisma.$transaction(async (tx) => {
      // Create or update user in INVITED state
      const targetUser = await tx.user.upsert({
        where: {
          companyId_email: {
            companyId: ctx.company.id,
            email,
          },
        },
        update: {
          roleId,
          status: UserStatus.INVITED,
          name: name || existingUser?.name || email.split("@")[0],
          deletedAt: null,
        },
        create: {
          companyId: ctx.company.id,
          roleId,
          email,
          name: name || email.split("@")[0],
          status: UserStatus.INVITED,
        },
      });

      // If teamId provided, add to team
      if (teamId) {
        await tx.teamMember.upsert({
          where: {
            teamId_userId: {
              teamId,
              userId: targetUser.id,
            },
          },
          update: {},
          create: {
            companyId: ctx.company.id,
            teamId,
            userId: targetUser.id,
          },
        });
      }

      // Create invitation record
      const inv = await tx.invitation.create({
        data: {
          companyId: ctx.company.id,
          email,
          roleId,
          teamId,
          tokenHash,
          invitedById: ctx.user.id,
          expiresAt,
        },
      });

      // Log audit event
      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "user.invited",
          entityType: "user",
          entityId: targetUser.id,
          metadata: {
            email,
            roleId,
            teamId,
            invitationId: inv.id,
          },
        },
      });

      return { invitation: inv, user: targetUser };
    });

    // 5. Send invitation email (mock / configured provider)
    const emailTemplate = EmailTemplates.invitation(rawToken, ctx.user.name, ctx.company.name);
    emailTemplate.to = email;
    // We can call EmailService or console log in mock
    const appUrl = getAppUrl();
    const inviteLink = `${appUrl}/app/invite/${rawToken}`;

    return {
      invitationId: invitation.id,
      userId: user.id,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      inviteLink,
    };
  }

  /**
   * Verify an invitation token (public/unauthenticated).
   */
  static async getInvitationByToken(rawToken: string) {
    if (!rawToken || typeof rawToken !== "string") {
      throw new ValidationError("Token is required");
    }

    const tokenHash = hashToken(rawToken);

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundError("Invalid invitation token");
    }

    if (invitation.usedAt !== null) {
      throw new ValidationError("This invitation has already been accepted");
    }

    if (invitation.expiresAt <= new Date()) {
      throw new ValidationError("This invitation has expired");
    }

    // Check if company is suspended
    if (invitation.company.status !== "ACTIVE") {
      throw new ValidationError("The inviting organization is currently inactive");
    }

    return {
      id: invitation.id,
      email: invitation.email,
      company: invitation.company,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accept invitation, set password, activate user account, and establish session.
   */
  static async acceptInvitation(input: AcceptInvitationInput, metadata?: { userAgent?: string; ipAddress?: string }) {
    const { token, password, name } = input;

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      throw new ValidationError(`Password is too weak: ${strength.errors.join(", ")}`);
    }

    const tokenHash = hashToken(token);

    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        company: true,
      },
    });

    if (!invitation) {
      throw new NotFoundError("Invalid invitation token");
    }

    if (invitation.usedAt !== null) {
      throw new ValidationError("This invitation has already been accepted");
    }

    if (invitation.expiresAt <= new Date()) {
      throw new ValidationError("This invitation has expired");
    }

    if (invitation.company.status !== "ACTIVE") {
      throw new ValidationError("The inviting organization is currently inactive");
    }

    const hashedPassword = await hashPassword(password);

    const { user, session } = await prisma.$transaction(async (tx) => {
      // 1. Find and update user
      const targetUser = await tx.user.findUnique({
        where: {
          companyId_email: {
            companyId: invitation.companyId,
            email: invitation.email,
          },
        },
      });

      if (!targetUser) {
        throw new NotFoundError("User record not found for this invitation");
      }

      const updatedUser = await tx.user.update({
        where: { id: targetUser.id },
        data: {
          hashedPassword,
          status: UserStatus.ACTIVE,
          ...(name ? { name } : {}),
          lastLoginAt: new Date(),
        },
        include: {
          role: true,
        },
      });

      // 2. If invitation had a teamId and not yet in team
      if (invitation.teamId) {
        await tx.teamMember.upsert({
          where: {
            teamId_userId: {
              teamId: invitation.teamId,
              userId: targetUser.id,
            },
          },
          update: {},
          create: {
            companyId: invitation.companyId,
            teamId: invitation.teamId,
            userId: targetUser.id,
          },
        });
      }

      // 3. Mark invitation used
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });

      // 4. Log audit event
      await tx.auditLog.create({
        data: {
          companyId: invitation.companyId,
          userId: targetUser.id,
          action: "user.created",
          entityType: "user",
          entityId: targetUser.id,
          metadata: {
            invitationId: invitation.id,
            acceptedAt: new Date(),
          },
        },
      });

      return { user: updatedUser, session: null };
    });

    // 5. Create active database session for immediate login
    const sessionData = await createDbSession(user.id, invitation.companyId, metadata);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
      },
      company: {
        id: invitation.company.id,
        name: invitation.company.name,
        slug: invitation.company.slug,
        onboardingCompleted: invitation.company.onboardingCompleted,
      },
      session: sessionData,
    };
  }
}
