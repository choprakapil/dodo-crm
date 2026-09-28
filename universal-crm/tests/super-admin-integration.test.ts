/**
 * Slice 8: Super Admin Platform Console Integration Tests
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { SuperAdminAuthService } from "../lib/services/super-admin-auth.service";
import { PlatformCompanyService } from "../lib/services/platform-company.service";
import { PlatformPlanService } from "../lib/services/platform-plan.service";
import { PlatformDashboardService } from "../lib/services/platform-dashboard.service";
import { PlatformAuditLogService } from "../lib/services/platform-audit-log.service";
import { QuotaService } from "../lib/services/quota.service";
import {
  createSuperAdminSession,
  validateSuperAdminSessionToken,
  revokeSuperAdminSessionByToken,
} from "../lib/auth/super-admin-session";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { hashPassword } from "../lib/auth/password";
import {
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
} from "../lib/errors";

export async function runSuperAdminIntegrationTests() {
  console.log("\n🧪 Running Slice 8: Super Admin Platform Console Integration Tests...");

  // 1. Setup / Verify Seeded Super Admin
  console.log("  → [Platform Setup] Ensuring active Super Admin exists...");
  let superAdmin = await prisma.superAdmin.findFirst({
    where: { email: "superadmin@universalcrm.platform", deletedAt: null },
  });

  if (!superAdmin) {
    const hashedPassword = await hashPassword("PlatformSuperSecret2026!");
    superAdmin = await prisma.superAdmin.create({
      data: {
        email: "superadmin@universalcrm.platform",
        name: "Platform Master Admin",
        hashedPassword,
        isActive: true,
      },
    });
  }

  // 2. Super Admin Authentication Lifecycle
  console.log("  → [Super Admin Auth] Login, session token verification, and logout...");
  
  // Successful login
  const loginResult = await SuperAdminAuthService.login(
    "superadmin@universalcrm.platform",
    "PlatformSuperSecret2026!",
    { ipAddress: "127.0.0.1", userAgent: "IntegrationTestRunner/1.0" }
  );

  assert.ok(loginResult.rawToken, "Login must return raw session token");
  assert.equal(loginResult.superAdmin.email, "superadmin@universalcrm.platform");

  // Validate session token
  const validatedCtx = await validateSuperAdminSessionToken(loginResult.rawToken);
  assert.ok(validatedCtx, "Super Admin session token must validate successfully");
  assert.equal(validatedCtx?.superAdmin.id, superAdmin.id);
  assert.equal(validatedCtx?.superAdmin.email, "superadmin@universalcrm.platform");

  // Failed login (wrong password)
  await assert.rejects(
    async () => {
      await SuperAdminAuthService.login(
        "superadmin@universalcrm.platform",
        "IncorrectPassword!"
      );
    },
    (err: any) => err instanceof UnauthorizedError,
    "Invalid password must throw UnauthorizedError"
  );

  // Logout / Revocation
  await SuperAdminAuthService.logout(
    loginResult.rawToken,
    { ipAddress: "127.0.0.1", userAgent: "IntegrationTestRunner/1.0" }
  );

  const postLogoutCtx = await validateSuperAdminSessionToken(loginResult.rawToken);
  assert.equal(postLogoutCtx, null, "Revoked session must not validate");

  // Re-login to get an active context for subsequent platform operations
  const activeLogin = await SuperAdminAuthService.login(
    "superadmin@universalcrm.platform",
    "PlatformSuperSecret2026!",
    { ipAddress: "127.0.0.1", userAgent: "IntegrationTestRunner/1.0" }
  );
  const platformCtx = (await validateSuperAdminSessionToken(activeLogin.rawToken))!;
  assert.ok(platformCtx);

  // 3. Platform Dashboard Telemetry
  console.log("  → [Platform Dashboard] Aggregated fleet telemetry...");
  const telemetry = await PlatformDashboardService.getTelemetry();
  assert.ok(telemetry.metrics.companies.total >= 1, "Must have at least 1 company");
  assert.ok(telemetry.metrics.companies.active >= 1, "Must have active companies");
  assert.ok(telemetry.metrics.users.total >= 1, "Must have registered users");
  assert.ok(Array.isArray(telemetry.planDistribution), "Plan distribution must be an array");
  assert.equal(telemetry.platformHealth.database, "CONNECTED", "Database health must be CONNECTED");

  // 4. Company Provisioning Lifecycle
  console.log("  → [Company Provisioning] Transactional provisioning of company, admin, roles, statuses & plans...");
  const testSlug = `test-provision-${Date.now()}`;
  const provisionResult = await PlatformCompanyService.provisionCompany(
    {
      name: "Apex Global Dynamics",
      slug: testSlug,
      initialAdminName: "Eleanor Vance",
      initialAdminEmail: `eleanor-${Date.now()}@apexglobal.test`,
      planTier: "STARTER",
      timezone: "America/Chicago",
      currency: "USD",
    },
    platformCtx.superAdmin.id
  );

  assert.ok(provisionResult.company.id, "Provisioned company must have an ID");
  assert.equal(provisionResult.company.slug, testSlug);
  assert.ok(provisionResult.inviteUrl, "Provisioning must return invitation URL");
  assert.ok(provisionResult.rawInviteToken, "Provisioning must return invitation raw token");

  // Verify DB entities created inside transaction
  const [createdRoles, createdStatuses, createdSources, createdCompany] = await Promise.all([
    prisma.role.findMany({ where: { companyId: provisionResult.company.id } }),
    prisma.leadStatus.findMany({ where: { companyId: provisionResult.company.id } }),
    prisma.leadSource.findMany({ where: { companyId: provisionResult.company.id } }),
    prisma.company.findUnique({
      where: { id: provisionResult.company.id },
      include: { plan: true },
    }),
  ]);

  assert.equal(createdRoles.length, 5, "Must provision exactly 5 system roles");
  const roleNames = createdRoles.map((r) => r.name).sort();
  assert.deepEqual(roleNames, ["Admin", "Manager", "Sales Rep", "Support", "Viewer"]);
  assert.ok(createdStatuses.length >= 4, "Must provision default lead statuses");
  assert.ok(createdSources.length >= 4, "Must provision default lead sources");
  assert.equal((createdCompany as any)?.plan?.code, "STARTER", "Company plan must match requested tier");

  // Duplicate slug prevention
  await assert.rejects(
    async () => {
      await PlatformCompanyService.provisionCompany(
        {
          name: "Duplicate Apex",
          slug: testSlug,
          initialAdminName: "Another Admin",
          initialAdminEmail: "another@apexglobal.test",
          planTier: "STARTER",
          timezone: "UTC",
          currency: "USD",
        },
        platformCtx.superAdmin.id
      );
    },
    (err: any) => err instanceof ValidationError,
    "Duplicate slug must be rejected with ValidationError"
  );

  // 5. Company Inspector & Quota Usage
  console.log("  → [Company Inspector] Inspecting provisioned company telemetry and quotas...");
  const details = await PlatformCompanyService.getCompanyDetails(provisionResult.company.id);
  assert.equal(details.company.name, "Apex Global Dynamics");
  assert.equal(details.quota.users.current, 1, "Initial admin counts toward users");
  assert.ok(details.quota.users.max > 0, "Plan must define max users");
  assert.equal(details.quota.leads.current, 0, "No leads yet");
  assert.ok(details.statistics.teams >= 0);

  // 6. Tenant Suspension & Session Purge Lifecycle
  console.log("  → [Tenant Suspension] Suspending company and ensuring tenant sessions are purged...");
  const initialAdminUser = await prisma.user.findUniqueOrThrow({
    where: { id: provisionResult.initialAdmin.id },
  });

  // Activate initial admin so they can establish an active tenant session
  await prisma.user.update({
    where: { id: initialAdminUser.id },
    data: { status: "ACTIVE", hashedPassword: await hashPassword("AdminPass123!") },
  });

  // Create an active tenant session for this user
  const tenantSession = await createDbSession(initialAdminUser.id, provisionResult.company.id);
  const activeTenantCtx = await validateSessionToken(tenantSession.rawToken);
  assert.ok(activeTenantCtx, "Tenant session must be active initially");

  // Suspend the company
  const suspendResult = await PlatformCompanyService.suspendCompany(
    provisionResult.company.id,
    "Non-payment during billing audit",
    platformCtx.superAdmin.id
  );
  assert.equal(suspendResult.status, "SUSPENDED");

  // Verify that all tenant sessions for that company are deleted/invalidated
  const postSuspendTenantCtx = await validateSessionToken(tenantSession.rawToken);
  assert.equal(postSuspendTenantCtx, null, "Suspended company session must be immediately invalidated");

  const sessionsRemaining = await prisma.session.count({
    where: { companyId: provisionResult.company.id },
  });
  assert.equal(sessionsRemaining, 0, "All tenant sessions must be purged from database on suspension");

  // Historical records must remain intact
  const userCountPostSuspend = await prisma.user.count({
    where: { companyId: provisionResult.company.id },
  });
  assert.equal(userCountPostSuspend, 1, "Users must not be deleted on suspension");

  // Reactivate the company
  console.log("  → [Tenant Reactivation] Restoring company status to ACTIVE...");
  const reactivateResult = await PlatformCompanyService.reactivateCompany(
    provisionResult.company.id,
    platformCtx.superAdmin.id,
    { ipAddress: "127.0.0.1" }
  );
  assert.equal(reactivateResult.status, "ACTIVE");

  // 7. Plans & Quota Management
  console.log("  → [Plan System] List plans, update quotas, and assign plans...");
  const plans = await PlatformPlanService.listPlans();
  assert.equal(plans.length, 4, "Must have exactly 4 default plan tiers");

  const starterPlan = (plans as any[]).find((p: any) => p.code === "STARTER")!;
  const enterprisePlan = (plans as any[]).find((p: any) => p.code === "ENTERPRISE")!;
  assert.ok(starterPlan && enterprisePlan);

  // Update starter plan limits
  const updatedStarter = await PlatformPlanService.updatePlan(
    starterPlan.id,
    {
      maxUsers: 15,
      maxLeads: 5000,
    },
    platformCtx.superAdmin.id
  );
  assert.equal(updatedStarter.maxUsers, 15);
  assert.equal(updatedStarter.maxLeads, 5000);

  // Assign ENTERPRISE plan to company
  const assigned = await PlatformPlanService.assignPlanToCompany(
    provisionResult.company.id,
    { planId: enterprisePlan.id },
    platformCtx.superAdmin.id
  );
  assert.equal((assigned as any).planId, enterprisePlan.id);

  // Quota service checks
  const quotaUsage = await QuotaService.getCompanyQuotaUsage(provisionResult.company.id);
  assert.equal(quotaUsage.plan.code, "ENTERPRISE");
  assert.equal(quotaUsage.usage.users.current, 1);
  assert.equal(quotaUsage.usage.users.isExceeded, false);
  assert.equal(quotaUsage.usage.leads.isExceeded, false);

  // 8. Platform Audit Log Verifications
  console.log("  → [Platform Audit Logs] Verifying immutable append-only audit trail...");
  const auditLogs = await PlatformAuditLogService.listLogs({
    superAdminId: superAdmin.id,
    limit: 10,
  });

  assert.ok(auditLogs.data.length >= 3, "Must have recorded multiple platform actions");
  const actions = auditLogs.data.map((l) => l.action);
  assert.ok(actions.includes("SUPER_ADMIN_LOGIN"), "Must include SUPER_ADMIN_LOGIN");
  assert.ok(actions.includes("COMPANY_CREATED"), "Must include COMPANY_CREATED");
  assert.ok(actions.includes("COMPANY_SUSPENDED"), "Must include COMPANY_SUSPENDED");
  assert.ok(actions.includes("COMPANY_REACTIVATED"), "Must include COMPANY_REACTIVATED");
  assert.ok(actions.includes("PLAN_ASSIGNED"), "Must include PLAN_ASSIGNED");

  // Clean up test context
  await revokeSuperAdminSessionByToken(activeLogin.rawToken);

  console.log("  ✅ Slice 8: Super Admin Integration Tests Passed!\n");
}
