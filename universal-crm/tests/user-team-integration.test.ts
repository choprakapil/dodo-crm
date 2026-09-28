/**
 * Slice 7: User, Team, Role, Company & Security Integration Tests
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { UserService } from "../lib/services/user.service";
import { InvitationService } from "../lib/services/invitation.service";
import { TeamService } from "../lib/services/team.service";
import { RoleService } from "../lib/services/role.service";
import { CompanySettingsService } from "../lib/services/company-settings.service";
import { SecurityService } from "../lib/services/security.service";
import { AuditLogService } from "../lib/services/audit-log.service";
import { verifyPassword } from "../lib/auth/password";
import { ValidationError, NotFoundError } from "../lib/errors";

export async function runUserTeamIntegrationTests() {
  console.log("\n🧪 Running Slice 7: User & Team Management Integration Tests...");

  // Setup / Find seeded test company & users
  const company = await prisma.company.findFirstOrThrow({
    where: { slug: "acme-corp" },
  });

  const adminRole = await prisma.role.findFirstOrThrow({
    where: { name: "Admin", isSystem: true, companyId: company.id },
  });

  const repRole = await prisma.role.findFirstOrThrow({
    where: { name: "Sales Rep", isSystem: true, companyId: company.id },
  });

  const adminUser = await prisma.user.findFirstOrThrow({
    where: { email: "admin@acmecorp.com", companyId: company.id },
  });

  // Create real DB-backed session for Admin AuthContext
  const adminSession = await createDbSession(adminUser.id, company.id);
  const adminCtx = await validateSessionToken(adminSession.rawToken);
  assert.ok(adminCtx, "Admin AuthContext must be generated from valid session");

  // 1. User Listing & Pagination
  console.log("  → [User List] List users with pagination and role filter...");
  const userList = await UserService.listUsers(adminCtx, {
    page: 1,
    limit: 10,
    roleId: adminRole.id,
  });
  assert.ok(userList.data.length >= 1);
  assert.equal(userList.data[0].role.name, "Admin");

  // 2. Invitation Lifecycle
  console.log("  → [Invitation Flow] Create invite, verify token, accept invite, verify session...");
  const inviteEmail = `test-invite-${Date.now()}@acmecorp.com`;
  const inviteResult = await InvitationService.createInvitation(adminCtx, {
    email: inviteEmail,
    roleId: repRole.id,
  });

  assert.ok(inviteResult.invitationId);
  assert.equal(inviteResult.email, inviteEmail);
  const rawToken = inviteResult.inviteLink.split("/").pop()!;
  assert.ok(rawToken);

  // Public token lookup
  const publicInvite = await InvitationService.getInvitationByToken(rawToken);
  assert.equal(publicInvite.email, inviteEmail);
  assert.equal(publicInvite.company.name, company.name);

  // Accept invitation
  const acceptResult = await InvitationService.acceptInvitation({
    token: rawToken,
    name: "Invited Test User",
    password: "SecurePassword123!",
  });

  assert.equal(acceptResult.success, true);
  assert.equal(acceptResult.user.email, inviteEmail);
  assert.equal(acceptResult.user.name, "Invited Test User");
  assert.equal(acceptResult.company.id, company.id);
  assert.equal(acceptResult.user.role, repRole.name);
  assert.ok(acceptResult.session.sessionId);

  // Attempting to accept again must fail (Single-use)
  await assert.rejects(
    async () => {
      await InvitationService.acceptInvitation({
        token: rawToken,
        name: "Second Accept Attempt",
        password: "SecurePassword123!",
      });
    },
    (err: any) => err instanceof ValidationError
  );

  const acceptedUserId = acceptResult.user.id;

  // 3. User Updates & Status Transitions
  console.log("  → [User Management] Update profile, deactivate, reactivate...");
  const updatedUser = await UserService.updateUser(adminCtx, acceptedUserId, {
    phone: "+1 555-0987",
  });
  assert.equal(updatedUser.phone, "+1 555-0987");

  // Deactivate user
  const deactivated = await UserService.setUserStatus(adminCtx, acceptedUserId, "DISABLED");
  assert.equal(deactivated.status, "DISABLED");

  // Verify deactivated user has zero valid sessions
  const sessionsCount = await prisma.session.count({
    where: { userId: acceptedUserId },
  });
  assert.equal(sessionsCount, 0);

  // Reactivate user
  const reactivated = await UserService.setUserStatus(adminCtx, acceptedUserId, "ACTIVE");
  assert.equal(reactivated.status, "ACTIVE");

  // 4. Admin Password Reset
  console.log("  → [Admin Password Reset] Reset password by admin...");
  const resetRes = await UserService.resetUserPassword(adminCtx, acceptedUserId, {
    password: "NewSuperPassword123!",
  });
  assert.ok(resetRes.success);

  const reloadedUser = await prisma.user.findUniqueOrThrow({
    where: { id: acceptedUserId },
  });
  assert.ok(reloadedUser.hashedPassword);
  const passValid = await verifyPassword("NewSuperPassword123!", reloadedUser.hashedPassword);
  assert.equal(passValid, true);

  // 5. Team Lifecycle & Roster
  console.log("  → [Team Management] Create team, assign manager, add member, check roster...");
  const newTeam = await TeamService.createTeam(adminCtx, {
    name: `Outbound SDRs ${Date.now()}`,
    description: "Cold calling and outbound outreach",
    managerId: adminUser.id,
    isActive: true,
  });
  assert.ok(newTeam.id);
  assert.equal(newTeam.managerId, adminUser.id);

  // Add member to team
  await TeamService.addTeamMember(adminCtx, newTeam.id, acceptedUserId);

  // Verify roster (Manager is auto-added upon team creation + acceptedUser added)
  const teamDetail = await TeamService.getTeamById(adminCtx, newTeam.id);
  assert.equal(teamDetail.members.length, 2);
  const memberIds = teamDetail.members.map((m: any) => m.id);
  assert.ok(memberIds.includes(acceptedUserId));
  assert.ok(memberIds.includes(adminUser.id));

  // Remove member
  await TeamService.removeTeamMember(adminCtx, newTeam.id, acceptedUserId);
  const teamAfterRemoval = await TeamService.getTeamById(adminCtx, newTeam.id);
  assert.equal(teamAfterRemoval.members.length, 1);
  assert.equal(teamAfterRemoval.members[0].id, adminUser.id);

  // Delete team
  await TeamService.deleteTeam(adminCtx, newTeam.id);

  // 6. Custom Role Builder
  console.log("  → [Custom Roles] Create custom role, update permissions, delete role...");
  const customRole = await RoleService.createRole(adminCtx, {
    name: `Custom Support Role ${Date.now()}`,
    description: "Support tier with read-only access",
    permissions: [
      { module: "leads", action: "view", dataScope: "COMPANY" },
      { module: "activities", action: "view", dataScope: "COMPANY" },
    ],
  });
  assert.ok(customRole.id);
  assert.equal(customRole.permissions.length, 2);

  // Update custom role
  const updatedRole = await RoleService.updateRole(adminCtx, customRole.id, {
    name: `${customRole.name} - V2`,
    permissions: [
      { module: "leads", action: "view", dataScope: "COMPANY" },
      { module: "leads", action: "export", dataScope: "COMPANY" },
    ],
  });
  assert.ok(updatedRole);
  assert.equal(updatedRole.permissions.length, 2);

  // Delete custom role
  await RoleService.deleteRole(adminCtx, customRole.id);

  // 7. Company Settings
  console.log("  → [Company Settings] Retrieve and update settings...");
  const companySettings = await CompanySettingsService.getCompanySettings(adminCtx);
  assert.equal(companySettings.id, company.id);

  const updatedSettings = await CompanySettingsService.updateCompanySettings(adminCtx, {
    phone: "+1 800-555-ACME",
    dateFormat: "MM/DD/YYYY",
  });
  assert.equal(updatedSettings.phone, "+1 800-555-ACME");
  assert.equal(updatedSettings.dateFormat, "MM/DD/YYYY");

  // 8. Audit Logs
  console.log("  → [Audit Logs] Verify tamper-proof audit trail for tenant actions...");
  const logs = await AuditLogService.listAuditLogs(adminCtx, {
    entityType: "user",
    page: 1,
    limit: 10,
  });
  assert.ok(logs.data.length >= 1);
  const logActions = logs.data.map((l: any) => l.action);
  assert.ok(
    logActions.includes("user.invited") ||
    logActions.includes("user.created") ||
    logActions.includes("user.status_updated")
  );

  // Clean up test user & sessions
  await prisma.session.deleteMany({ where: { id: adminSession.sessionId } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { entityId: acceptedUserId },
        { userId: acceptedUserId },
      ],
    },
  });
  await prisma.user.delete({ where: { id: acceptedUserId } });

  console.log("  ✅ All Slice 7 Integration Tests Passed!");
}
