/**
 * Integration Tests for Slice 2: Authentication, Session Lifecycle, and Status Gates
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import {
  createDbSession,
  validateSessionToken,
  revokeSessionByToken,
  revokeAllUserSessions,
} from "../lib/auth/session";
import { verifyPassword, hashPassword } from "../lib/auth/password";
import { generateSecureToken, hashToken } from "../lib/utils/tokens";
import { UserStatus, CompanyStatus } from "@prisma/client";

async function runIntegrationTests() {
  console.log("\n🧪 Running Integration Tests: Database Auth & Session Lifecycle...");

  // 1. Find seeded test user
  console.log("  → Fetching seeded Acme Corp user...");
  const user = await prisma.user.findFirst({
    where: { email: "admin@acmecorp.com" },
    include: { company: true, role: true },
  });
  assert.ok(user, "admin@acmecorp.com should exist in seeded database");
  assert.ok(user.hashedPassword, "User must have a hashed password");

  // 2. Verify seeded credentials
  console.log("  → Verifying seeded password verification...");
  const validPass = await verifyPassword("Admin@Acme123!", user.hashedPassword);
  assert.equal(validPass, true, "Seeded password must match");

  const invalidPass = await verifyPassword("WrongPassword123!", user.hashedPassword);
  assert.equal(invalidPass, false, "Invalid password must be rejected");

  // 3. Create active session
  console.log("  → Creating database-backed session...");
  const sessionData = await createDbSession(user.id, user.companyId, {
    userAgent: "IntegrationTestAgent/1.0",
    ipAddress: "127.0.0.1",
  });
  assert.ok(sessionData.rawToken, "Must return raw token");
  assert.ok(sessionData.sessionId, "Must return session ID");

  // 4. Validate active session
  console.log("  → Validating active session token...");
  const authContext = await validateSessionToken(sessionData.rawToken);
  assert.ok(authContext, "Session must validate successfully");
  assert.equal(authContext.user.id, user.id, "Context user ID must match");
  assert.equal(authContext.user.email, user.email, "Context user email must match");
  assert.equal(authContext.company.id, user.companyId, "Context company ID must match");
  assert.equal(authContext.company.name, user.company.name, "Context company name must match");
  assert.ok(authContext.permissions.length > 0, "Permissions must be loaded");
  assert.equal(authContext.hasPermission("leads", "view"), true, "Admin should have leads.view permission");

  // 5. Revoke session and verify instant invalidation
  console.log("  → Testing session revocation...");
  await revokeSessionByToken(sessionData.rawToken);
  const revokedContext = await validateSessionToken(sessionData.rawToken);
  assert.equal(revokedContext, null, "Revoked session must return null immediately");

  // 6. Expired session rejection
  console.log("  → Testing expired session rejection...");
  const expiredRawToken = generateSecureToken(32);
  const expiredHash = hashToken(expiredRawToken);
  await prisma.session.create({
    data: {
      userId: user.id,
      companyId: user.companyId,
      tokenHash: expiredHash,
      expiresAt: new Date(Date.now() - 1000 * 60), // 1 minute in the past
    },
  });
  const expiredContext = await validateSessionToken(expiredRawToken);
  assert.equal(expiredContext, null, "Expired session must be rejected");

  // 7. Disabled user session rejection
  console.log("  → Testing disabled user rejection...");
  // Create a temporary user with DISABLED status
  const disabledUser = await prisma.user.create({
    data: {
      companyId: user.companyId,
      roleId: user.roleId,
      email: `disabled_${Date.now()}@acmecorp.com`,
      name: "Disabled Test User",
      status: UserStatus.DISABLED,
      hashedPassword: await hashPassword("TestPass@123!"),
    },
  });

  const disabledSession = await createDbSession(disabledUser.id, disabledUser.companyId);
  const disabledContext = await validateSessionToken(disabledSession.rawToken);
  assert.equal(disabledContext, null, "Disabled user must NOT be allowed active session");

  // 8. Suspended company session rejection
  console.log("  → Testing suspended company rejection...");
  const suspendedCompany = await prisma.company.create({
    data: {
      name: `Suspended Corp ${Date.now()}`,
      slug: `suspended-corp-${Date.now()}`,
      currency: "USD",
      status: CompanyStatus.SUSPENDED,
    },
  });

  const suspendedRole = await prisma.role.create({
    data: {
      companyId: suspendedCompany.id,
      name: "Admin",
    },
  });

  const suspendedUser = await prisma.user.create({
    data: {
      companyId: suspendedCompany.id,
      roleId: suspendedRole.id,
      email: `user@suspended${Date.now()}.com`,
      name: "Suspended User",
      status: UserStatus.ACTIVE,
      hashedPassword: await hashPassword("TestPass@123!"),
    },
  });

  const suspendedSession = await createDbSession(suspendedUser.id, suspendedUser.companyId);
  const suspendedContext = await validateSessionToken(suspendedSession.rawToken);
  assert.equal(suspendedContext, null, "User of suspended company must NOT be allowed active session");

  // 9. Password Reset Token single-use and expiration lifecycle
  console.log("  → Testing password reset token lifecycle...");
  const resetRawToken = generateSecureToken(32);
  const resetTokenHash = hashToken(resetRawToken);
  const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour future

  const resetRecord = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: resetTokenHash,
      expiresAt,
    },
  });

  // Verify token exists and is unused
  const foundToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: resetTokenHash },
  });
  assert.ok(foundToken, "Reset token must exist");
  assert.equal(foundToken.usedAt, null, "Reset token must be unused");

  // Mark token as used
  await prisma.passwordResetToken.update({
    where: { id: resetRecord.id },
    data: { usedAt: new Date() },
  });

  const usedToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: resetTokenHash },
  });
  assert.notEqual(usedToken?.usedAt, null, "Used token must have usedAt timestamp");

  // 10. Test revokeAllUserSessions
  console.log("  → Testing bulk session revocation on user...");
  const s1 = await createDbSession(user.id, user.companyId);
  const s2 = await createDbSession(user.id, user.companyId);
  assert.ok(await validateSessionToken(s1.rawToken), "s1 must be valid");
  assert.ok(await validateSessionToken(s2.rawToken), "s2 must be valid");

  await revokeAllUserSessions(user.id);
  assert.equal(await validateSessionToken(s1.rawToken), null, "s1 must be revoked");
  assert.equal(await validateSessionToken(s2.rawToken), null, "s2 must be revoked");

  // Clean up test records
  await prisma.user.delete({ where: { id: disabledUser.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: suspendedUser.id } }).catch(() => {});
  await prisma.role.delete({ where: { id: suspendedRole.id } }).catch(() => {});
  await prisma.company.delete({ where: { id: suspendedCompany.id } }).catch(() => {});

  console.log("✅ Integration tests passed successfully!\n");
}

export { runIntegrationTests };

if (require.main === module) {
  runIntegrationTests()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("❌ Integration tests failed:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
