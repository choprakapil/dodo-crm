/**
 * Slice 7: User, Team, Role, Company & Security Adversarial Spectator Tests
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { UserService } from "../lib/services/user.service";
import { RoleService } from "../lib/services/role.service";
import { InvitationService } from "../lib/services/invitation.service";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";

export async function runUserTeamSpectatorTests() {
  console.log("\n🕵️ Running Slice 7: Adversarial Spectator & Privilege Escalation Tests...");

  const company = await prisma.company.findFirstOrThrow({
    where: { slug: "acme-corp" },
  });

  const repRole = await prisma.role.findFirstOrThrow({
    where: { name: "Sales Rep", isSystem: true, companyId: company.id },
  });

  const repUser = await prisma.user.findFirstOrThrow({
    where: { email: "sarah@acmecorp.com", companyId: company.id },
  });

  const adminRole = await prisma.role.findFirstOrThrow({
    where: { name: "Admin", isSystem: true, companyId: company.id },
  });

  const adminUser = await prisma.user.findFirstOrThrow({
    where: { email: "admin@acmecorp.com", companyId: company.id },
  });

  // Real DB sessions
  const repSession = await createDbSession(repUser.id, company.id);
  const repCtx = await validateSessionToken(repSession.rawToken);
  assert.ok(repCtx);

  const adminSession = await createDbSession(adminUser.id, company.id);
  const adminCtx = await validateSessionToken(adminSession.rawToken);
  assert.ok(adminCtx);

  // 1. Unauthorized Access by Sales Rep
  console.log("  → [Privilege Violation] Sales Rep attempts user and role management...");
  await assert.rejects(
    async () => {
      await UserService.listUsers(repCtx, { page: 1, limit: 10 });
    },
    (err: any) => err instanceof ForbiddenError
  );

  await assert.rejects(
    async () => {
      await UserService.setUserStatus(repCtx, adminUser.id, "DISABLED");
    },
    (err: any) => err instanceof ForbiddenError
  );

  await assert.rejects(
    async () => {
      await UserService.resetUserPassword(repCtx, adminUser.id, { password: "Hack123!" });
    },
    (err: any) => err instanceof ForbiddenError
  );

  await assert.rejects(
    async () => {
      await RoleService.createRole(repCtx, {
        name: "Elevated Role",
        permissions: [{ module: "settings", action: "manage", dataScope: "COMPANY" }],
      });
    },
    (err: any) => err instanceof ForbiddenError
  );

  // 2. System Role Tamper Resistance
  console.log("  → [Tamper Resistance] Attempting to modify or delete system roles...");
  await assert.rejects(
    async () => {
      await RoleService.updateRole(adminCtx, adminRole.id, { name: "Compromised Admin" });
    },
    (err: any) => err instanceof ValidationError
  );

  await assert.rejects(
    async () => {
      await RoleService.deleteRole(adminCtx, adminRole.id);
    },
    (err: any) => err instanceof ValidationError
  );

  // 3. Self-Disabling & Last Admin Guard
  console.log("  → [Self-Preservation] Admin attempting to deactivate self...");
  await assert.rejects(
    async () => {
      await UserService.setUserStatus(adminCtx, adminUser.id, "DISABLED");
    },
    (err: any) => err instanceof ValidationError
  );

  // 4. Expired and Tampered Invitation Tokens
  console.log("  → [Token Integrity] Expired and corrupted invitation token attacks...");
  // Create an invitation
  const inviteResult = await InvitationService.createInvitation(adminCtx, {
    email: `expired-${Date.now()}@acmecorp.com`,
    roleId: repRole.id,
  });
  const rawToken = inviteResult.inviteLink.split("/").pop()!;

  // Manually backdate the expiration in database
  await prisma.invitation.update({
    where: { id: inviteResult.invitationId },
    data: { expiresAt: new Date(Date.now() - 3600 * 1000) }, // 1 hour ago
  });

  // Attempting to lookup expired token
  await assert.rejects(
    async () => {
      await InvitationService.getInvitationByToken(rawToken);
    },
    (err: any) => err instanceof ValidationError
  );

  // Attempting to accept expired token
  await assert.rejects(
    async () => {
      await InvitationService.acceptInvitation({
        token: rawToken,
        name: "Expired User",
        password: "ValidPassword123!",
      });
    },
    (err: any) => err instanceof ValidationError
  );

  // Attempting invalid / corrupted token
  await assert.rejects(
    async () => {
      await InvitationService.getInvitationByToken("tampered-fake-token-hex-12345");
    },
    (err: any) => err instanceof NotFoundError
  );

  // Clean up
  await prisma.session.deleteMany({
    where: { id: { in: [repSession.sessionId, adminSession.sessionId] } },
  });
  await prisma.invitation.delete({ where: { id: inviteResult.invitationId } });
  await prisma.user.delete({ where: { id: inviteResult.userId } });

  console.log("  ✅ All Slice 7 Adversarial Spectator Tests Passed!");
}
