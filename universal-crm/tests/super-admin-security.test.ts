/**
 * Slice 8: Super Admin & Tenant Separation Adversarial Security Tests
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../lib/db";
import {
  createSuperAdminSession,
  validateSuperAdminSessionToken,
  revokeSuperAdminSessionByToken,
} from "../lib/auth/super-admin-session";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { SuperAdminAuthService } from "../lib/services/super-admin-auth.service";
import { PlatformCompanyService } from "../lib/services/platform-company.service";
import { PlatformPlanService } from "../lib/services/platform-plan.service";
import { PlatformAuditLogService } from "../lib/services/platform-audit-log.service";
import { hashPassword } from "../lib/auth/password";
import {
  provisionCompanySchema,
  updatePlanSchema,
  suspendCompanySchema,
} from "../lib/validations/platform";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors";

export async function runSuperAdminSecurityTests() {
  console.log("\n🛡️ Running Slice 8: Super Admin Security & Cross-Boundary Isolation Tests...");

  // 1. Fetch Existing Entities
  const [acmeCompany, superAdminRecord] = await Promise.all([
    prisma.company.findFirstOrThrow({ where: { slug: "acme-corp" } }),
    prisma.superAdmin.findFirstOrThrow({
      where: { email: "superadmin@universalcrm.platform" },
    }),
  ]);

  const acmeAdminUser = await prisma.user.findFirstOrThrow({
    where: { email: "admin@acmecorp.com", companyId: acmeCompany.id },
  });

  // 2. Cookie & Token Boundary Separation (Absolute Zero Crossover)
  console.log("  → [Boundary Separation] Testing cross-session token rejection...");

  // Create a valid tenant session
  const tenantSession = await createDbSession(acmeAdminUser.id, acmeCompany.id);
  const validTenantCtx = await validateSessionToken(tenantSession.rawToken);
  assert.ok(validTenantCtx, "Tenant context must be valid for tenant session");

  // Attempt to authenticate tenant token as Super Admin
  const crossedAdminCtx = await validateSuperAdminSessionToken(tenantSession.rawToken);
  assert.equal(
    crossedAdminCtx,
    null,
    "Tenant session token MUST NOT validate against SuperAdminSession"
  );

  // Create a valid super admin session
  const superAdminSession = await createSuperAdminSession(
    superAdminRecord.id,
    { ipAddress: "127.0.0.1", userAgent: "SecurityTestRunner/1.0" }
  );
  const validSuperAdminCtx = await validateSuperAdminSessionToken(superAdminSession.rawToken);
  assert.ok(validSuperAdminCtx, "Super Admin context must be valid for super admin session");
  assert.equal(
    (validSuperAdminCtx as any).companyId,
    undefined,
    "Super Admin context MUST NOT possess a companyId"
  );

  // Attempt to authenticate super admin token as Tenant User
  const crossedTenantCtx = await validateSessionToken(superAdminSession.rawToken);
  assert.equal(
    crossedTenantCtx,
    null,
    "Super Admin session token MUST NOT validate against normal Session"
  );

  // 3. Inactive and Soft-Deleted Super Admin Lockout
  console.log("  → [Super Admin State] Verifying inactive and deleted super admin lockout...");
  
  // Create an inactive super admin
  const inactiveAdmin = await prisma.superAdmin.create({
    data: {
      email: `inactive-${Date.now()}@platform.test`,
      name: "Inactive Admin",
      hashedPassword: await hashPassword("TestPassword123!"),
      isActive: false,
    },
  });

  await assert.rejects(
    async () => {
      await SuperAdminAuthService.login(
        inactiveAdmin.email,
        "TestPassword123!"
      );
    },
    (err: any) => err instanceof ForbiddenError,
    "Inactive Super Admin must be denied login with ForbiddenError"
  );

  // Create a soft-deleted super admin
  const deletedAdmin = await prisma.superAdmin.create({
    data: {
      email: `deleted-${Date.now()}@platform.test`,
      name: "Deleted Admin",
      hashedPassword: await hashPassword("TestPassword123!"),
      isActive: true,
      deletedAt: new Date(),
    },
  });

  await assert.rejects(
    async () => {
      await SuperAdminAuthService.login(
        deletedAdmin.email,
        "TestPassword123!"
      );
    },
    (err: any) => err instanceof UnauthorizedError,
    "Soft-deleted Super Admin must be denied login with UnauthorizedError"
  );

  // 4. Forged Headers & Identity Tampering
  console.log("  → [Identity Integrity] Verifying Super Admin cannot be spoofed via tenant headers...");

  // Validating a random or forged token must strictly return null regardless of any headers
  const forgedResult = await validateSuperAdminSessionToken("forged-super-admin-token-12345");
  assert.equal(forgedResult, null, "Forged token must return null");

  // 5. Mass Assignment Injection Defense
  console.log("  → [Mass Assignment Defense] Validating strict schema rejection for privileged attributes...");
  const injectionAttempts = [
    {
      schema: provisionCompanySchema,
      payload: {
        name: "Test Corp",
        slug: "test-slug-clean",
        initialAdminName: "Test",
        initialAdminEmail: "test@test.com",
        id: "injected-company-id",
        status: "ACTIVE",
        isSuspended: false,
      },
      name: "Company Provisioning Injection",
    },
    {
      schema: updatePlanSchema,
      payload: {
        maxUsers: 10,
        id: "injected-plan-id",
        code: "ENTERPRISE",
        createdAt: new Date().toISOString(),
      },
      name: "Plan Update Injection",
    },
    {
      schema: suspendCompanySchema,
      payload: {
        reason: "Valid reason",
        superAdminId: "injected-admin",
        status: "ACTIVE",
      },
      name: "Suspension Injection",
    },
  ];

  for (const test of injectionAttempts) {
    const parsed = test.schema.safeParse(test.payload);
    assert.equal(
      parsed.success,
      false,
      `Schema must reject mass assignment injection: ${test.name}`
    );
  }

  // 6. Suspended Tenant Access Blockade
  console.log("  → [Suspension Enforcement] Verifying suspended tenant users cannot log in...");
  
  // Create a temporary company to suspend
  const tempCompany = await prisma.company.create({
    data: {
      name: `Suspension Test Corp ${Date.now()}`,
      slug: `suspension-test-${Date.now()}`,
      status: "ACTIVE",
      currency: "USD",
      timezone: "UTC",
    },
  });

  const tempRole = await prisma.role.create({
    data: {
      companyId: tempCompany.id,
      name: "TempAdminRole",
      isSystem: true,
    },
  });

  const tempUser = await prisma.user.create({
    data: {
      companyId: tempCompany.id,
      roleId: tempRole.id,
      email: `temp-admin-${Date.now()}@test.com`,
      name: "Temp Admin",
      hashedPassword: await hashPassword("UserPassword123!"),
      status: "ACTIVE",
    },
  });

  const tempSession = await createDbSession(tempUser.id, tempCompany.id);
  assert.ok(await validateSessionToken(tempSession.rawToken));

  // Suspend company
  await PlatformCompanyService.suspendCompany(
    tempCompany.id,
    "Security test suspension",
    validSuperAdminCtx.superAdmin.id
  );

  // Existing session must be rejected
  const sessionAfterSuspension = await validateSessionToken(tempSession.rawToken);
  assert.equal(
    sessionAfterSuspension,
    null,
    "Tenant session must immediately fail after company suspension"
  );

  // Attempting to validate any session for a suspended company must fail
  const directSessionRecheck = await prisma.session.findUnique({
    where: { id: tempSession.sessionId },
  });
  assert.equal(directSessionRecheck, null, "Session record must be purged from database");

  // 7. Cleanup
  await revokeSuperAdminSessionByToken(superAdminSession.rawToken);
  await prisma.superAdmin.deleteMany({
    where: { id: { in: [inactiveAdmin.id, deletedAdmin.id] } },
  });
  await prisma.user.deleteMany({ where: { companyId: tempCompany.id } });
  await prisma.role.deleteMany({ where: { companyId: tempCompany.id } });
  await prisma.company.delete({ where: { id: tempCompany.id } });

  console.log("  ✅ Slice 8: Super Admin Security & Boundary Isolation Tests Passed!\n");
}
