/**
 * Slice 7: User, Team, Role, Company & Security Tenant Isolation Tests
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { UserService } from "../lib/services/user.service";
import { TeamService } from "../lib/services/team.service";
import { RoleService } from "../lib/services/role.service";
import { AuditLogService } from "../lib/services/audit-log.service";
import { NotFoundError, ValidationError } from "../lib/errors";

export async function runUserTeamTenantSecurityTests() {
  console.log("\n🛡️ Running Slice 7: Tenant Isolation & IDOR Defense Tests...");

  // Fetch Company A (Acme Corp) and Company B (Zenith Solutions)
  const [companyA, companyB] = await Promise.all([
    prisma.company.findFirstOrThrow({ where: { slug: "acme-corp" } }),
    prisma.company.findFirstOrThrow({ where: { slug: "zenith-solutions" } }),
  ]);

  const userA = await prisma.user.findFirstOrThrow({
    where: { email: "admin@acmecorp.com", companyId: companyA.id },
  });

  const userB = await prisma.user.findFirstOrThrow({
    where: { email: "admin@zenithsolutions.com", companyId: companyB.id },
  });

  // Admin A AuthContext via real DB session
  const sessionA = await createDbSession(userA.id, companyA.id);
  const ctxA = await validateSessionToken(sessionA.rawToken);
  assert.ok(ctxA, "Admin A AuthContext must be created");

  // 1. Cross-Tenant User IDOR Attack
  console.log("  → [IDOR Attack: User] Tenant A admin attempts to read/update Tenant B user...");
  await assert.rejects(
    async () => {
      await UserService.getUserById(ctxA, userB.id);
    },
    (err: any) => err instanceof NotFoundError
  );

  await assert.rejects(
    async () => {
      await UserService.updateUser(ctxA, userB.id, { name: "Hacked by Tenant A" });
    },
    (err: any) => err instanceof NotFoundError
  );

  await assert.rejects(
    async () => {
      await UserService.setUserStatus(ctxA, userB.id, "DISABLED");
    },
    (err: any) => err instanceof NotFoundError
  );

  await assert.rejects(
    async () => {
      await UserService.resetUserPassword(ctxA, userB.id, { password: "HackedPassword123!" });
    },
    (err: any) => err instanceof NotFoundError
  );

  // 2. Cross-Tenant Team IDOR Attack & Entity Injection
  console.log("  → [IDOR Attack: Team] Tenant A attempts to manipulate Tenant B teams...");
  // Create a team in Company B
  const teamB = await prisma.team.create({
    data: {
      companyId: companyB.id,
      name: `Zenith Secret Team ${Date.now()}`,
      isActive: true,
    },
  });

  // Tenant A attempts to read Team B
  await assert.rejects(
    async () => {
      await TeamService.getTeamById(ctxA, teamB.id);
    },
    (err: any) => err instanceof NotFoundError
  );

  // Tenant A attempts to update Team B
  await assert.rejects(
    async () => {
      await TeamService.updateTeam(ctxA, teamB.id, { name: "Tampered Team" });
    },
    (err: any) => err instanceof NotFoundError
  );

  // Tenant A attempts to delete Team B
  await assert.rejects(
    async () => {
      await TeamService.deleteTeam(ctxA, teamB.id);
    },
    (err: any) => err instanceof NotFoundError
  );

  // Entity Injection: Tenant A attempts to add Tenant B user into a Tenant A team
  const teamA = await TeamService.createTeam(ctxA, {
    name: `Acme Security Team ${Date.now()}`,
    isActive: true,
  });

  await assert.rejects(
    async () => {
      await TeamService.addTeamMember(ctxA, teamA.id, userB.id);
    },
    (err: any) => err instanceof NotFoundError || err instanceof ValidationError
  );

  // Entity Injection: Tenant A attempts to assign Tenant B user as Manager
  await assert.rejects(
    async () => {
      await TeamService.updateTeam(ctxA, teamA.id, { managerId: userB.id });
    },
    (err: any) => err instanceof NotFoundError || err instanceof ValidationError
  );

  // Clean up test teams
  await TeamService.deleteTeam(ctxA, teamA.id);
  await prisma.team.delete({ where: { id: teamB.id } });

  // 3. Cross-Tenant Custom Role Isolation
  console.log("  → [IDOR Attack: Role] Tenant A attempts to mutate Tenant B custom role...");
  const roleB = await prisma.role.create({
    data: {
      companyId: companyB.id,
      name: `Zenith Custom Role ${Date.now()}`,
      isSystem: false,
    },
  });

  await assert.rejects(
    async () => {
      await RoleService.updateRole(ctxA, roleB.id, { name: "Hijacked Role" });
    },
    (err: any) => err instanceof NotFoundError
  );

  await assert.rejects(
    async () => {
      await RoleService.deleteRole(ctxA, roleB.id);
    },
    (err: any) => err instanceof NotFoundError
  );

  await prisma.role.delete({ where: { id: roleB.id } });

  // 4. Cross-Tenant Audit Log Leakage Defense
  console.log("  → [Audit Leakage Defense] Verifying zero cross-tenant audit log disclosure...");
  const logsA = await AuditLogService.listAuditLogs(ctxA, { page: 1, limit: 100 });
  for (const log of logsA.data) {
    const raw = await prisma.auditLog.findUniqueOrThrow({ where: { id: log.id } });
    assert.equal(raw.companyId, companyA.id, "Audit log leaked cross-tenant company data!");
  }

  await prisma.session.deleteMany({ where: { id: sessionA.sessionId } });

  console.log("  ✅ All Slice 7 Tenant Isolation & IDOR Defense Tests Passed!");
}
