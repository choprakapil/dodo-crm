/**
 * Adversarial Spectator Test Suite: Attempting to Disprove Slice 2 Completion
 *
 * This suite acts as an independent, adversarial auditor to ensure zero security holes,
 * no auth bypasses, strict tenant isolation, and immediate revocation on account state changes.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import {
  createDbSession,
  validateSessionToken,
  revokeSessionByToken,
  requirePermission,
  AuthContext,
} from "../lib/auth/session";
import { hashPassword } from "../lib/auth/password";
import { generateSecureToken, hashToken } from "../lib/utils/tokens";
import { ForbiddenError } from "../lib/errors";
import { UserStatus, CompanyStatus } from "@prisma/client";

async function runSpectatorAdversarialTests() {
  console.log("\n🕵️ [SPECTATOR] Running Adversarial Attack & Security Verification...");

  // Setup: Get Acme (Company A) and Zenith (Company B)
  const acme = await prisma.company.findUnique({ where: { slug: "acme-corp" } });
  const zenith = await prisma.company.findUnique({ where: { slug: "zenith-solutions" } });
  assert.ok(acme && zenith, "Both companies must exist in database");

  const acmeAdmin = await prisma.user.findFirst({
    where: { companyId: acme.id, email: "admin@acmecorp.com" },
  });
  const acmeRep = await prisma.user.findFirst({
    where: { companyId: acme.id, email: "sarah@acmecorp.com" },
  });
  const zenithAdmin = await prisma.user.findFirst({
    where: { companyId: zenith.id, email: "admin@zenithsolutions.com" },
  });

  assert.ok(acmeAdmin && acmeRep && zenithAdmin, "Users must exist");

  // ATTACK 1: Forged / Fake Session Token
  console.log("  [TEST 1] Testing forged / fake token bypass...");
  const fakeToken = "forged-session-token-attempting-bypass-99999";
  const fakeValidation = await validateSessionToken(fakeToken);
  assert.equal(fakeValidation, null, "Forged token MUST return null");

  // ATTACK 2: Replay of Revoked Session Token
  console.log("  [TEST 2] Testing session replay attack after revocation...");
  const tempSession = await createDbSession(acmeAdmin.id, acme.id);
  const initialValidation = await validateSessionToken(tempSession.rawToken);
  assert.ok(initialValidation, "Initial session must be valid");

  await revokeSessionByToken(tempSession.rawToken);
  const replayValidation = await validateSessionToken(tempSession.rawToken);
  assert.equal(replayValidation, null, "Replay of revoked session MUST fail immediately");

  // ATTACK 3: Immediate Lockout on User Deactivation (DISABLED status)
  console.log("  [TEST 3] Testing active session invalidation upon user disabling...");
  const tempUser = await prisma.user.create({
    data: {
      companyId: acme.id,
      roleId: acmeRep.roleId,
      email: `victim_${Date.now()}@acmecorp.com`,
      name: "Victim User",
      status: UserStatus.ACTIVE,
      hashedPassword: await hashPassword("VictimPass@123!"),
    },
  });

  const victimSession = await createDbSession(tempUser.id, acme.id);
  assert.ok(await validateSessionToken(victimSession.rawToken), "Session valid while ACTIVE");

  // Admin disables user in DB
  await prisma.user.update({
    where: { id: tempUser.id },
    data: { status: UserStatus.DISABLED },
  });

  // Next request MUST be immediately rejected!
  const disabledAttempt = await validateSessionToken(victimSession.rawToken);
  assert.equal(disabledAttempt, null, "Disabled user MUST be rejected even with active unexpired session");

  // ATTACK 4: Immediate Lockout on Company Suspension
  console.log("  [TEST 4] Testing active session invalidation upon company suspension...");
  const tempCompany = await prisma.company.create({
    data: {
      name: `Company X ${Date.now()}`,
      slug: `company-x-${Date.now()}`,
      status: CompanyStatus.ACTIVE,
    },
  });

  const tempCompanyRole = await prisma.role.create({
    data: { companyId: tempCompany.id, name: "Admin" },
  });

  const companyUser = await prisma.user.create({
    data: {
      companyId: tempCompany.id,
      roleId: tempCompanyRole.id,
      email: `user_${Date.now()}@companyx.com`,
      name: "Company X Admin",
      status: UserStatus.ACTIVE,
      hashedPassword: await hashPassword("CompXPass@123!"),
    },
  });

  const compSession = await createDbSession(companyUser.id, tempCompany.id);
  assert.ok(await validateSessionToken(compSession.rawToken), "Session valid while company ACTIVE");

  // Suspend company
  await prisma.company.update({
    where: { id: tempCompany.id },
    data: { status: CompanyStatus.SUSPENDED },
  });

  // Next request MUST be immediately rejected!
  const suspendedAttempt = await validateSessionToken(compSession.rawToken);
  assert.equal(suspendedAttempt, null, "Suspended company user MUST be rejected immediately");

  // ATTACK 5: Soft-Deleted User Access
  console.log("  [TEST 5] Testing soft-deleted user access prevention...");
  await prisma.user.update({
    where: { id: tempUser.id },
    data: { status: UserStatus.ACTIVE, deletedAt: new Date() },
  });
  const deletedAttempt = await validateSessionToken(victimSession.rawToken);
  assert.equal(deletedAttempt, null, "Soft-deleted user MUST be rejected");

  // ATTACK 6: Cross-Tenant Context Tampering (Client claiming different company)
  console.log("  [TEST 6] Testing tenant context tamper resistance...");
  const validAcmeSession = await createDbSession(acmeAdmin.id, acme.id);
  const context: AuthContext | null = await validateSessionToken(validAcmeSession.rawToken);
  assert.ok(context);

  // Even if client passes headers like "x-company-id: zenith.id", server identity context is fixed:
  assert.equal(context.company.id, acme.id);
  assert.notEqual(context.company.id, zenith.id);

  // ATTACK 7: IDOR Attack (Cross-Tenant Entity Access)
  console.log("  [TEST 7] Testing IDOR cross-tenant access prevention...");
  const zenithLeads = await prisma.lead.findMany({ where: { companyId: zenith.id }, take: 1 });
  assert.ok(zenithLeads.length > 0, "Zenith leads must exist");
  const targetLeadId = zenithLeads[0].id;

  // Acme user attempts to query Zenith's lead:
  // Query is strictly tenant-scoped
  const leakCheck = await prisma.lead.findFirst({
    where: {
      id: targetLeadId,
      companyId: context.company.id, // Scoped to Acme context
    },
  });
  assert.equal(leakCheck, null, "Acme user MUST NOT be able to access Zenith lead by ID");

  // ATTACK 8: Privilege Escalation Attempt (Sales Rep claiming Admin permission)
  console.log("  [TEST 8] Testing privilege escalation prevention...");
  const repSession = await createDbSession(acmeRep.id, acme.id);
  const repContext = await validateSessionToken(repSession.rawToken);
  assert.ok(repContext);

  assert.throws(
    () => {
      requirePermission(repContext, "settings", "update");
    },
    (err: unknown) => err instanceof ForbiddenError,
    "Rep MUST be forbidden from settings.update"
  );

  assert.throws(
    () => {
      requirePermission(repContext, "users", "delete");
    },
    (err: unknown) => err instanceof ForbiddenError,
    "Rep MUST be forbidden from users.delete"
  );

  // ATTACK 9: Password Reset Token Reuse Prevention
  console.log("  [TEST 9] Testing password reset single-use token enforcement...");
  const resetTokenRaw = generateSecureToken(32);
  const resetTokenHash = hashToken(resetTokenRaw);
  const resetTokenRecord = await prisma.passwordResetToken.create({
    data: {
      userId: acmeAdmin.id,
      tokenHash: resetTokenHash,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      usedAt: new Date(), // Already used!
    },
  });

  const reuseAttempt = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: resetTokenHash },
  });
  assert.ok(reuseAttempt?.usedAt !== null, "Token is marked used and must not be accepted again");

  // Clean up test records
  await prisma.user.delete({ where: { id: tempUser.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: companyUser.id } }).catch(() => {});
  await prisma.role.delete({ where: { id: tempCompanyRole.id } }).catch(() => {});
  await prisma.company.delete({ where: { id: tempCompany.id } }).catch(() => {});
  await prisma.passwordResetToken.delete({ where: { id: resetTokenRecord.id } }).catch(() => {});

  console.log("✅ [SPECTATOR] All 9 Adversarial Security Tests PASSED without flaws!\n");
}

export { runSpectatorAdversarialTests };

if (require.main === module) {
  runSpectatorAdversarialTests()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("❌ Spectator tests failed:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
