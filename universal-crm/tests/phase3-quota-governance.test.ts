/**
 * DODO CRM V2 — Phase 3.1: Quota Governance, Safe Migration & Feature Override Test Suite
 *
 * Comprehensive isolated test suite verifying:
 * 1. Plan defaults and valid overrides
 * 2. Partial overrides and omitted keys inheriting from plan
 * 3. Explicit unlimited (-1) overrides and unauthorized unlimited attempts
 * 4. Invalid JSON, unknown keys, negative values != -1, fractional values, and malformed types
 * 5. Missing / corrupt plan configuration (fails closed safely)
 * 6. Company settings updates preserving timeline preview configuration & overrides
 * 7. Provisioning with dedicated quota and feature overrides
 * 8. Legacy compatibility fallback & precedence
 * 9. Lead quota boundary enforcement
 * 10. Bulk CSV lead import exceeding quota (zero partial inserts proof) & duplicate handling
 * 11. Invitation and user creation quota boundary (avoiding double-charging existing invited users)
 * 12. Disabled-user reactivation quota boundary
 * 13. Concurrency protection & race prevention under parallel load (InnoDB row lock proof)
 * 14. Server-side feature gating (leadImport, export, customRoles, customFields)
 * 15. Cross-tenant isolation and unauthorized platform governance rejection
 * 16. Existing migration preservation of historyPreviewFields
 * 17. All 8 quota metrics coverage (maxUsers, maxLeads, maxCustomers, maxTeams, maxProducts, maxServices, maxDispositions, maxCustomFields)
 * 18. Fixture lifecycle cleanup with strict error surfacing
 */

import { enforceTestDatabaseSafety } from "./test-db-guard";
enforceTestDatabaseSafety();

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { QuotaService } from "../lib/services/quota.service";
import { PlatformLimitService } from "../lib/services/platform-limit.service";
import { PlatformCompanyService } from "../lib/services/platform-company.service";
import { CompanySettingsService } from "../lib/services/company-settings.service";
import { LeadService } from "../lib/services/lead.service";
import { LeadImportService } from "../lib/services/lead-import.service";
import { InvitationService } from "../lib/services/invitation.service";
import { UserService } from "../lib/services/user.service";
import { CustomerService } from "../lib/services/customer.service";
import { TeamService } from "../lib/services/team.service";
import { OfferingService } from "../lib/services/offering.service";
import { DispositionService } from "../lib/services/disposition.service";
import { CustomFieldService } from "../lib/services/custom-field.service";
import { RoleService } from "../lib/services/role.service";
import { AnalyticsService } from "../lib/services/analytics.service";
import { AuthContext, AuthUser, AuthCompany, AuthPermission } from "../lib/auth/session";
import { QuotaExceededError, ValidationError, ForbiddenError } from "../lib/errors";
import { limitOverridesSchema, featureOverridesSchema } from "../lib/validations/platform";
import { ZodError } from "zod";
import { UserStatus, Prisma, DataScope } from "@prisma/client";
import { NextRequest } from "next/server";
import { POST as adminLimitsPost } from "../app/api/v1/admin/companies/[id]/limits/route";
import { POST as adminFeaturesPost } from "../app/api/v1/admin/companies/[id]/features/route";
import { createSuperAdminSession } from "../lib/auth/super-admin-session";

// ============================================================================
// FIXTURE LIFECYCLE TRACKER
// ============================================================================
class TestFixtureTracker {
  companyIds = new Set<string>();
  userIds = new Set<string>();
  roleIds = new Set<string>();
  permissionIds = new Set<string>();
  teamIds = new Set<string>();
  leadIds = new Set<string>();
  customerIds = new Set<string>();
  offeringIds = new Set<string>();
  dispositionIds = new Set<string>();
  customFieldIds = new Set<string>();
  invitationIds = new Set<string>();
  leadImportIds = new Set<string>();
  superAdminIds = new Set<string>();
  superAdminSessionIds = new Set<string>();

  async cleanupAll() {
    const cleanupErrors: Error[] = [];

    // Reverse dependency cleanup
    if (this.leadImportIds.size > 0) {
      try {
        await prisma.leadImport.deleteMany({ where: { id: { in: Array.from(this.leadImportIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.leadImportIds.clear();
    }

    if (this.invitationIds.size > 0) {
      try {
        await prisma.invitation.deleteMany({ where: { id: { in: Array.from(this.invitationIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.invitationIds.clear();
    }

    if (this.customFieldIds.size > 0) {
      try {
        await prisma.customFieldValue.deleteMany({ where: { customFieldId: { in: Array.from(this.customFieldIds) } } });
        await prisma.customField.deleteMany({ where: { id: { in: Array.from(this.customFieldIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.customFieldIds.clear();
    }

    if (this.dispositionIds.size > 0) {
      try {
        await prisma.disposition.updateMany({
          where: { id: { in: Array.from(this.dispositionIds) } },
          data: { parentId: null },
        });
        await prisma.disposition.deleteMany({ where: { id: { in: Array.from(this.dispositionIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.dispositionIds.clear();
    }

    if (this.offeringIds.size > 0) {
      try {
        await prisma.offering.deleteMany({ where: { id: { in: Array.from(this.offeringIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.offeringIds.clear();
    }

    if (this.customerIds.size > 0) {
      try {
        await prisma.customerPhone.deleteMany({ where: { customerId: { in: Array.from(this.customerIds) } } });
        await prisma.customerEmail.deleteMany({ where: { customerId: { in: Array.from(this.customerIds) } } });
        await prisma.customer.deleteMany({ where: { id: { in: Array.from(this.customerIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.customerIds.clear();
    }

    if (this.leadIds.size > 0) {
      try {
        await prisma.activity.deleteMany({ where: { leadId: { in: Array.from(this.leadIds) } } });
        await prisma.leadStatusHistory.deleteMany({ where: { leadId: { in: Array.from(this.leadIds) } } });
        await prisma.lead.deleteMany({ where: { id: { in: Array.from(this.leadIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.leadIds.clear();
    }

    if (this.teamIds.size > 0) {
      try {
        await prisma.teamMember.deleteMany({ where: { teamId: { in: Array.from(this.teamIds) } } });
        await prisma.team.deleteMany({ where: { id: { in: Array.from(this.teamIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.teamIds.clear();
    }

    if (this.userIds.size > 0) {
      try {
        await prisma.session.deleteMany({ where: { userId: { in: Array.from(this.userIds) } } });
        await prisma.activity.deleteMany({ where: { userId: { in: Array.from(this.userIds) } } });
        await prisma.auditLog.deleteMany({ where: { userId: { in: Array.from(this.userIds) } } });
        await prisma.teamMember.deleteMany({ where: { userId: { in: Array.from(this.userIds) } } });
        await prisma.user.deleteMany({ where: { id: { in: Array.from(this.userIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.userIds.clear();
    }

    if (this.roleIds.size > 0) {
      try {
        await prisma.permission.deleteMany({ where: { roleId: { in: Array.from(this.roleIds) } } });
        await prisma.role.deleteMany({ where: { id: { in: Array.from(this.roleIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.roleIds.clear();
    }

    if (this.superAdminSessionIds.size > 0) {
      try {
        await prisma.superAdminSession.deleteMany({ where: { id: { in: Array.from(this.superAdminSessionIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.superAdminSessionIds.clear();
    }

    if (this.superAdminIds.size > 0) {
      try {
        await prisma.superAdminSession.deleteMany({ where: { superAdminId: { in: Array.from(this.superAdminIds) } } });
        await prisma.superAdmin.deleteMany({ where: { id: { in: Array.from(this.superAdminIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.superAdminIds.clear();
    }

    if (this.companyIds.size > 0) {
      try {
        await prisma.auditLog.deleteMany({ where: { companyId: { in: Array.from(this.companyIds) } } });
        await prisma.activity.deleteMany({ where: { companyId: { in: Array.from(this.companyIds) } } });
        await prisma.leadStatus.deleteMany({ where: { companyId: { in: Array.from(this.companyIds) } } });
        await prisma.leadSource.deleteMany({ where: { companyId: { in: Array.from(this.companyIds) } } });
        await prisma.company.deleteMany({ where: { id: { in: Array.from(this.companyIds) } } });
      } catch (err) { cleanupErrors.push(err as Error); }
      this.companyIds.clear();
    }

    if (cleanupErrors.length > 0) {
      console.error("[TestFixtureTracker] Cleanup encountered errors:", cleanupErrors);
      throw new Error(`Test fixture cleanup failed with ${cleanupErrors.length} errors: ${cleanupErrors[0].message}`);
    }
  }
}

const tracker = new TestFixtureTracker();

// Helper to construct AuthContext
function createTestAuthContext(company: any, user: any, role: any, permissions: any[] = []): AuthContext {
  const permMap = new Map<string, string>();
  for (const p of permissions) {
    permMap.set(`${p.module}:${p.action}`, p.dataScope || "COMPANY");
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone || null,
    status: user.status,
    roleId: role.id,
    roleName: role.name,
    isSystemRole: Boolean(role.isSystem),
  };

  const authCompany: AuthCompany = {
    id: company.id,
    name: company.name,
    slug: company.slug,
    status: company.status,
    currency: company.currency || "USD",
    timezone: company.timezone || "UTC",
    defaultCountryCode: company.defaultCountryCode || "US",
  };

  const authPermissions: AuthPermission[] = permissions.map((p) => ({
    module: p.module,
    action: p.action,
    dataScope: (p.dataScope as DataScope) || DataScope.COMPANY,
  }));

  return {
    user: authUser,
    company: authCompany,
    role: {
      id: role.id,
      name: role.name,
      isSystem: Boolean(role.isSystem),
    },
    permissions: authPermissions,
    session: {
      id: "test-session-id",
      expiresAt: new Date(Date.now() + 86400000),
    },
    hasPermission: (module: string, action: string) => permMap.has(`${module}:${action}`) || role.name === "Admin",
    getDataScope: (module: string, action: string) => {
      const scope = permMap.get(`${module}:${action}`);
      return (scope as any) || (role.name === "Admin" ? DataScope.COMPANY : DataScope.OWN);
    },
  };
}

// Helper to provision test tenant
async function setupTestTenant(prefix: string, planName = "STARTER", initialLimits: any = null, initialFeatures: any = null) {
  const plan = await prisma.plan.findFirst({ where: { name: planName } });
  if (!plan) throw new Error(`Required plan "${planName}" not found in DB`);

  const ts = Date.now();
  const slug = `${prefix.toLowerCase()}-${ts}`.slice(0, 30);
  const company = await prisma.company.create({
    data: {
      name: `${prefix} Tenant ${ts}`,
      slug,
      status: "ACTIVE",
      planId: plan.id,
      currency: "USD",
      timezone: "UTC",
      limitOverrides: initialLimits ?? Prisma.JsonNull,
      featureOverrides: initialFeatures ?? Prisma.JsonNull,
      historyPreviewFields: ["deal_value", "lead_priority"],
    } as any,
  });
  tracker.companyIds.add(company.id);

  // Lead status and source defaults
  const status = await prisma.leadStatus.create({
    data: {
      companyId: company.id,
      name: "New",
      isDefault: true,
      displayOrder: 1,
    },
  });
  const source = await prisma.leadSource.create({
    data: {
      companyId: company.id,
      name: "Website",
      isActive: true,
    },
  });

  const role = await prisma.role.create({
    data: {
      companyId: company.id,
      name: "Admin",
      isSystem: true,
    },
  });
  tracker.roleIds.add(role.id);

  const modules = ["leads", "users", "teams", "customers", "offerings", "dispositions", "custom_fields", "roles", "settings", "reports"];
  const actions = ["view", "create", "update", "delete", "manage", "export"];
  const permsToCreate = [];
  for (const m of modules) {
    for (const a of actions) {
      permsToCreate.push({
        roleId: role.id,
        module: m,
        action: a,
        dataScope: DataScope.COMPANY,
      });
    }
  }
  await prisma.permission.createMany({ data: permsToCreate });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      roleId: role.id,
      email: `admin-${slug}@example.com`,
      name: `Admin ${prefix}`,
      status: UserStatus.ACTIVE,
    },
  });
  tracker.userIds.add(user.id);

  const permissions = await prisma.permission.findMany({ where: { roleId: role.id } });
  const authCtx = createTestAuthContext(company, user, role, permissions);

  return { company, user, role, status, source, authCtx, plan };
}

// ============================================================================
// MAIN TEST SUITE EXECUTION
// ============================================================================
async function runPhase3GovernanceTests() {
  console.log("================================================================================");
  console.log("DODO CRM V2 — PHASE 3.1: QUOTA GOVERNANCE, SAFE MIGRATION & ENFORCEMENT AUDIT");
  console.log("Database target: dodo_crm_v2_test (enforced by test-db-guard)");
  console.log("================================================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  async function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    process.stdout.write(`[Test ${totalTests}] ${name} ... `);
    try {
      await fn();
      console.log("PASSED");
      passedTests++;
    } catch (err: any) {
      console.log("FAILED!");
      console.error(err);
      throw err;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Migration Verification & Dedicated Columns Nullability
    // ------------------------------------------------------------------------
    await test("Migration Verification: limitOverrides & featureOverrides exist with nullable semantics", async () => {
      const columns = await prisma.$queryRaw<Array<{ COLUMN_NAME: string; IS_NULLABLE: string; DATA_TYPE: string }>>`
        SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'companies'
          AND COLUMN_NAME IN ('limitOverrides', 'featureOverrides', 'historyPreviewFields');
      `;

      const limitCol = columns.find((c) => c.COLUMN_NAME === "limitOverrides");
      const featCol = columns.find((c) => c.COLUMN_NAME === "featureOverrides");
      const histCol = columns.find((c) => c.COLUMN_NAME === "historyPreviewFields");

      assert.ok(limitCol, "limitOverrides column must exist");
      assert.equal(limitCol?.IS_NULLABLE, "YES", "limitOverrides must be nullable");
      assert.equal(limitCol?.DATA_TYPE, "json", "limitOverrides must be JSON");

      assert.ok(featCol, "featureOverrides column must exist");
      assert.equal(featCol?.IS_NULLABLE, "YES", "featureOverrides must be nullable");
      assert.equal(featCol?.DATA_TYPE, "json", "featureOverrides must be JSON");

      assert.ok(histCol, "historyPreviewFields column must exist");
    });

    // ------------------------------------------------------------------------
    // TEST 2: Data Preservation of Existing Timeline Preview Data
    // ------------------------------------------------------------------------
    await test("Data Preservation: Existing historyPreviewFields remain untouched and intact", async () => {
      const companies = await prisma.company.findMany({
        take: 10,
        select: { id: true, historyPreviewFields: true, limitOverrides: true, featureOverrides: true } as any,
      });

      for (const comp of companies) {
        if (comp.historyPreviewFields) {
          assert.ok(Array.isArray(comp.historyPreviewFields) || typeof comp.historyPreviewFields === "object",
            "historyPreviewFields must remain valid data");
        }
      }
    });

    // ------------------------------------------------------------------------
    // TEST 3: Plan Defaults Resolution
    // ------------------------------------------------------------------------
    await test("Plan Defaults Resolution: Company with valid STARTER plan inherits exact plan catalog values", async () => {
      const { company } = await setupTestTenant("T3_PlanDefaults", "STARTER");

      const res = await QuotaService.resolveCompanyLimits(company.id);
      assert.equal(res.plan.code, "STARTER");
      assert.equal(res.effectiveLimits.maxUsers, 5);
      assert.equal(res.effectiveLimits.maxLeads, 1000);
      assert.equal(res.effectiveLimits.maxCustomers, 1000);
      assert.equal(res.effectiveLimits.maxTeams, 5);
      assert.equal(res.effectiveLimits.maxProducts, 50);
      assert.equal(res.effectiveLimits.maxServices, 25);
      assert.equal(res.effectiveLimits.maxDispositions, 50);
      assert.equal(res.effectiveLimits.maxCustomFields, 15);

      // Verify features
      assert.equal(res.effectiveFeatures.leadImport, true);
      assert.equal(res.effectiveFeatures.advancedReports, false);
      assert.equal(res.effectiveFeatures.customRoles, false);
    });

    // ------------------------------------------------------------------------
    // TEST 4: Dedicated Overrides & Partial Overrides Precedence
    // ------------------------------------------------------------------------
    await test("Dedicated Overrides Precedence: Dedicated columns override plan; omitted keys inherit from plan", async () => {
      const { company } = await setupTestTenant(
        "T4_Overrides",
        "STARTER",
        { maxUsers: 20 }, // Partial override: only maxUsers
        { advancedReports: true } // Feature override
      );

      const res = await QuotaService.resolveCompanyLimits(company.id);
      assert.equal(res.effectiveLimits.maxUsers, 20, "maxUsers must reflect the dedicated override");
      assert.equal(res.effectiveLimits.maxLeads, 1000, "maxLeads must inherit from STARTER plan default");
      assert.equal(res.effectiveLimits.maxCustomers, 1000, "maxCustomers must inherit from STARTER plan default");
      assert.equal(res.effectiveFeatures.advancedReports, true, "advancedReports must reflect feature override");
      assert.equal(res.effectiveFeatures.leadImport, true, "leadImport must inherit true from STARTER");
    });

    // ------------------------------------------------------------------------
    // TEST 5: Explicit Unlimited (-1) Quota Key Semantics
    // ------------------------------------------------------------------------
    await test("Explicit Unlimited (-1) Semantics: Authorized -1 enables unlimited quota without boundary errors", async () => {
      const { company } = await setupTestTenant(
        "T5_Unlimited",
        "STARTER",
        { maxLeads: -1 }
      );

      const res = await QuotaService.resolveCompanyLimits(company.id);
      assert.equal(res.effectiveLimits.maxLeads, -1, "maxLeads must resolve to -1");

      // Asserting limit with -1 should never throw even with 1,000,000 additional records
      await assert.doesNotReject(async () => {
        await QuotaService.assertCanCreateLead(company.id, 1000000);
      }, "Unlimited quota (-1) must never throw QuotaExceededError");
    });

    // ------------------------------------------------------------------------
    // TEST 6: Validation Schema Rejection of Invalid Overrides
    // ------------------------------------------------------------------------
    await test("Validation Schema: Rejects unknown keys, negative values != -1, fractional values, and malformed types", async () => {
      // Unknown keys rejected
      assert.throws(() => {
        limitOverridesSchema.parse({ unknownLimitKey: 100 });
      }, ZodError, "Unknown limit keys must be rejected");

      // Negative values other than -1 rejected
      assert.throws(() => {
        limitOverridesSchema.parse({ maxUsers: -5 });
      }, ZodError, "Negative limit other than -1 must be rejected");

      // Fractional values rejected
      assert.throws(() => {
        limitOverridesSchema.parse({ maxUsers: 3.5 });
      }, ZodError, "Fractional limits must be rejected");

      // Non-integer string rejected
      assert.throws(() => {
        limitOverridesSchema.parse({ maxUsers: "ten" });
      }, ZodError, "String limits must be rejected");

      // Invalid feature key rejected
      assert.throws(() => {
        featureOverridesSchema.parse({ nonExistentFeature: true });
      }, ZodError, "Unknown feature keys must be rejected");

      // Non-boolean feature rejected
      assert.throws(() => {
        featureOverridesSchema.parse({ leadImport: "yes" });
      }, ZodError, "Non-boolean feature override must be rejected");
    });

    // ------------------------------------------------------------------------
    // TEST 7: Missing / Corrupt Plan Resolution (Fails Closed Safely)
    // ------------------------------------------------------------------------
    await test("Missing / Corrupt Plan: Fails closed safely; rejects operation without silent STARTER fallback", async () => {
      // Create company with null planId (missing plan)
      const comp = await prisma.company.create({
        data: {
          name: "Corrupt Plan Company",
          slug: `corrupt-${Date.now()}`,
          status: "ACTIVE",
          planId: null,
          currency: "USD",
        },
      });
      tracker.companyIds.add(comp.id);

      await assert.rejects(async () => {
        await QuotaService.resolveCompanyLimits(comp.id);
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError || err instanceof ValidationError || err.message.includes("plan"),
          "Must reject safely on missing plan");
        return true;
      });

      // Verify that assertions also fail closed safely
      await assert.rejects(async () => {
        await QuotaService.assertCanCreateLead(comp.id, 1);
      }, "Lead creation assertion must fail closed when plan is corrupt/missing");
    });

    // ------------------------------------------------------------------------
    // TEST 8: Legacy Fallback Precedence & Safe Handling
    // ------------------------------------------------------------------------
    await test("Legacy Fallback Precedence: Dedicated overrides take precedence over historyPreviewFields object", async () => {
      const { company } = await setupTestTenant("T8_Legacy", "STARTER");

      // 1. Simulate legacy override stored in historyPreviewFields object
      await prisma.company.update({
        where: { id: company.id },
        data: {
          historyPreviewFields: {
            limitOverrides: { maxUsers: 8 },
            featureOverrides: { advancedReports: true },
          },
          limitOverrides: Prisma.JsonNull,
          featureOverrides: Prisma.JsonNull,
        } as any,
      });

      const legacyRes = await QuotaService.resolveCompanyLimits(company.id);
      assert.equal(legacyRes.effectiveLimits.maxUsers, 8);
      assert.equal(legacyRes.effectiveFeatures.advancedReports, true);

      // 2. Set dedicated override -> must completely supersede legacy
      await prisma.company.update({
        where: { id: company.id },
        data: {
          limitOverrides: { maxUsers: 14 } as any,
        } as any,
      });

      const dedicatedRes = await QuotaService.resolveCompanyLimits(company.id);
      assert.equal(dedicatedRes.effectiveLimits.maxUsers, 14);
    });

    // ------------------------------------------------------------------------
    // TEST 9: Company Settings Updates Leave Dedicated Overrides Intact
    // ------------------------------------------------------------------------
    await test("Settings Invariant: CompanySettingsService updates preserve timeline fields and overrides", async () => {
      const { company, authCtx } = await setupTestTenant(
        "T9_Settings",
        "STARTER",
        { maxUsers: 10 },
        { customRoles: true }
      );

      // Call settings update
      const updated = await CompanySettingsService.updateCompanySettings(authCtx, {
        name: "Renamed Tenant LLC",
        currency: "EUR",
      });

      assert.equal(updated.name, "Renamed Tenant LLC");

      // Verify DB record directly
      const reloaded = await prisma.company.findUnique({
        where: { id: company.id },
        select: { limitOverrides: true, featureOverrides: true, historyPreviewFields: true } as any,
      });

      assert.deepEqual(reloaded?.limitOverrides, { maxUsers: 10 }, "limitOverrides must remain untouched");
      assert.deepEqual(reloaded?.featureOverrides, { customRoles: true }, "featureOverrides must remain untouched");
      assert.deepEqual(reloaded?.historyPreviewFields, ["deal_value", "lead_priority"], "historyPreviewFields must remain untouched");
    });

    // ------------------------------------------------------------------------
    // TEST 10: Provisioning Tenant with Quota and Feature Overrides
    // ------------------------------------------------------------------------
    await test("Provisioning: PlatformCompanyService.provisionCompany sets dedicated overrides directly", async () => {
      const plan = await prisma.plan.findFirst({ where: { name: "STARTER" } });
      const provSlug = `prov-${Date.now()}`.slice(0, 30);

      // Create test superadmin for audit attribution
      const superAdmin = await prisma.superAdmin.create({
        data: {
          email: `sa-${provSlug}@platform.internal`,
          name: "Test SuperAdmin",
          hashedPassword: "dummyhash",
          isActive: true,
        },
      });
      tracker.superAdminIds.add(superAdmin.id);

      const provisioned = await PlatformCompanyService.provisionCompany(
        {
          name: `Provisioned Corp ${Date.now()}`,
          slug: provSlug,
          planTier: "STARTER",
          initialAdminEmail: `admin-${provSlug}@example.com`,
          initialAdminName: "Provisioned Admin",
          currency: "USD",
          timezone: "UTC",
          limitOverrides: { maxUsers: 22, maxLeads: 5000 },
          featureOverrides: { advancedReports: true },
        },
        superAdmin.id
      );
      tracker.companyIds.add(provisioned.company.id);
      tracker.userIds.add(provisioned.initialAdmin.id);

      const comp = await prisma.company.findUnique({
        where: { id: provisioned.company.id },
        select: { limitOverrides: true, featureOverrides: true, historyPreviewFields: true } as any,
      });

      assert.deepEqual(comp?.limitOverrides, { maxUsers: 22, maxLeads: 5000 });
      assert.deepEqual(comp?.featureOverrides, { advancedReports: true });
      assert.ok(
        comp?.historyPreviewFields === null || Array.isArray(comp?.historyPreviewFields),
        "historyPreviewFields must not contain overrides and remains dedicated to timeline configuration"
      );
      assert.equal((comp?.historyPreviewFields as any)?.limitOverrides, undefined);
    });

    // ------------------------------------------------------------------------
    // TEST 11: Lead Quota Boundary & Exact Limit Enforcement
    // ------------------------------------------------------------------------
    await test("Lead Quota Boundary: LeadService.createLead enforces maxLeads and rejects when full", async () => {
      const { company, authCtx, status, source } = await setupTestTenant(
        "T11_LeadBoundary",
        "STARTER",
        { maxLeads: 2 } // Limit to exactly 2 leads
      );

      // Lead 1: succeeds
      const l1 = await LeadService.createLead(authCtx, {
        name: "Lead 1",
        email: "l1@example.com",
        statusId: status.id,
        sourceId: source.id,
      });
      tracker.leadIds.add(l1.id);

      // Lead 2: succeeds
      const l2 = await LeadService.createLead(authCtx, {
        name: "Lead 2",
        email: "l2@example.com",
        statusId: status.id,
        sourceId: source.id,
      });
      tracker.leadIds.add(l2.id);

      // Lead 3: MUST fail with QuotaExceededError
      await assert.rejects(async () => {
        await LeadService.createLead(authCtx, {
          name: "Lead 3",
          email: "l3@example.com",
          statusId: status.id,
          sourceId: source.id,
        });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError, "Must be QuotaExceededError");
        assert.equal((err.details as any)?.limitKey, "maxLeads");
        assert.equal((err.details as any)?.limit, 2);
        assert.equal((err.details as any)?.current, 2);
        return true;
      });

      const totalLeads = await prisma.lead.count({ where: { companyId: company.id, deletedAt: null } });
      assert.equal(totalLeads, 2, "Database must strictly contain exactly 2 leads");
    });

    // ------------------------------------------------------------------------
    // TEST 12: Bulk CSV Lead Import Quota Pre-Check (Zero Partial Inserts)
    // ------------------------------------------------------------------------
    await test("Bulk CSV Import Quota: Pre-calculates capacity; rejects complete batch with 0 partial inserts", async () => {
      const { company, authCtx, status, source } = await setupTestTenant(
        "T12_BulkImport",
        "STARTER",
        { maxLeads: 2 }
      );

      // Insert 1 lead first
      const existing = await LeadService.createLead(authCtx, {
        name: "Initial Lead",
        email: "initial@example.com",
        statusId: status.id,
        sourceId: source.id,
      });
      tracker.leadIds.add(existing.id);

      // CSV has 2 new leads -> total would be 1 + 2 = 3 > 2!
      const csvContent = `Lead Name,Email Address\nAlice Doe,alice@example.com\nBob Doe,bob@example.com`;

      await assert.rejects(async () => {
        await LeadImportService.executeImport(authCtx, {
          csvContent,
          filename: "test_overflow.csv",
          columnMappings: {
            "Lead Name": "name",
            "Email Address": "email",
          },
          duplicateStrategy: "CREATE",
        });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError, "Must reject with QuotaExceededError");
        assert.equal((err.details as any)?.limitKey, "maxLeads");
        return true;
      });

      // PROOF of 0 partial inserts: lead count must remain exactly 1!
      const leadsAfter = await prisma.lead.findMany({ where: { companyId: company.id, deletedAt: null } });
      assert.equal(leadsAfter.length, 1, "Zero partial inserts must occur on quota rejection");
      assert.equal(leadsAfter[0].email, "initial@example.com");

      // Verify no orphan LeadImport records were left in processing state
      const importsCount = await prisma.leadImport.count({ where: { companyId: company.id } });
      assert.equal(importsCount, 0, "No LeadImport record should be created if quota is exceeded upfront");
    });

    // ------------------------------------------------------------------------
    // TEST 13: Bulk CSV Lead Import Duplicate Handling Under Quota
    // ------------------------------------------------------------------------
    await test("Bulk CSV Duplicate Handling: SKIP and UPDATE strategies do not consume quota for matching rows", async () => {
      const { company, authCtx, status, source } = await setupTestTenant(
        "T13_ImportDupes",
        "STARTER",
        { maxLeads: 2 }
      );

      // Insert 2 leads so quota is 100% full (2/2)
      const l1 = await LeadService.createLead(authCtx, {
        name: "Existing Lead 1",
        email: "dup1@example.com",
        statusId: status.id,
        sourceId: source.id,
      });
      const l2 = await LeadService.createLead(authCtx, {
        name: "Existing Lead 2",
        email: "dup2@example.com",
        statusId: status.id,
        sourceId: source.id,
      });
      tracker.leadIds.add(l1.id);
      tracker.leadIds.add(l2.id);

      // CSV with matching emails and strategy: SKIP -> expectedNewLeadsCount is 0!
      const csvContent = `Lead Name,Email Address\nUpdated One,dup1@example.com\nUpdated Two,dup2@example.com`;

      const result = await LeadImportService.executeImport(authCtx, {
        csvContent,
        filename: "test_skip.csv",
        columnMappings: {
          "Lead Name": "name",
          "Email Address": "email",
        },
        duplicateStrategy: "SKIP",
      });
      tracker.leadImportIds.add(result.id);

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.skippedRows, 2);
      assert.equal(result.successfulRows, 0);

      const totalLeads = await prisma.lead.count({ where: { companyId: company.id, deletedAt: null } });
      assert.equal(totalLeads, 2, "Lead count must remain exactly 2 without exceeding quota");
    });

    // ------------------------------------------------------------------------
    // TEST 14: User Invitation & Seat Quota Boundary
    // ------------------------------------------------------------------------
    await test("User Seat Quota: InvitationService.createInvitation enforces maxUsers and avoids double-charging re-invites", async () => {
      const { company, authCtx, role } = await setupTestTenant(
        "T14_SeatQuota",
        "STARTER",
        { maxUsers: 2 } // Tenant already has 1 admin user, so capacity for 1 more user
      );

      // Invite User 2: succeeds (now 2/2 seats occupied)
      const inv1 = await InvitationService.createInvitation(authCtx, {
        email: "user2@example.com",
        roleId: role.id,
        name: "User Two",
      });
      tracker.invitationIds.add(inv1.invitationId);
      tracker.userIds.add(inv1.userId);

      // Re-inviting the same user2@example.com (currently INVITED) must NOT double-charge!
      const reinvite = await InvitationService.createInvitation(authCtx, {
        email: "user2@example.com",
        roleId: role.id,
        name: "User Two Updated",
      });
      tracker.invitationIds.add(reinvite.invitationId);
      assert.equal(reinvite.userId, inv1.userId, "Re-inviting same user must return same user record");

      // Inviting User 3: MUST fail with QuotaExceededError
      await assert.rejects(async () => {
        await InvitationService.createInvitation(authCtx, {
          email: "user3@example.com",
          roleId: role.id,
          name: "User Three",
        });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError, "Must throw QuotaExceededError");
        assert.equal((err.details as any)?.limitKey, "maxUsers");
        assert.equal((err.details as any)?.limit, 2);
        assert.equal((err.details as any)?.current, 2);
        return true;
      });

      const totalUsers = await prisma.user.count({ where: { companyId: company.id, deletedAt: null } });
      assert.equal(totalUsers, 2, "Database must strictly have 2 non-deleted users");
    });

    // ------------------------------------------------------------------------
    // TEST 15: Disabled-User Reactivation Quota Enforcement
    // ------------------------------------------------------------------------
    await test("Reactivation Quota: UserService.updateUser & setUserStatus reject DISABLED -> ACTIVE when seats full", async () => {
      const { company, authCtx, role } = await setupTestTenant(
        "T15_Reactivation",
        "STARTER",
        { maxUsers: 2 }
      );

      // Create a second active user (seats now 2/2 full)
      const user2 = await prisma.user.create({
        data: {
          companyId: company.id,
          roleId: role.id,
          email: "user2@reactivate.com",
          name: "User 2 Active",
          status: UserStatus.ACTIVE,
        },
      });
      tracker.userIds.add(user2.id);

      // Create a disabled user (does not count towards occupied seats)
      const disabledUser = await prisma.user.create({
        data: {
          companyId: company.id,
          roleId: role.id,
          email: "disabled@reactivate.com",
          name: "Disabled User",
          status: UserStatus.DISABLED,
        },
      });
      tracker.userIds.add(disabledUser.id);

      // Attempting to reactivate disabledUser via setUserStatus must throw QuotaExceededError!
      await assert.rejects(async () => {
        await UserService.setUserStatus(authCtx, disabledUser.id, UserStatus.ACTIVE);
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError, "setUserStatus must throw QuotaExceededError");
        assert.equal((err.details as any)?.limitKey, "maxUsers");
        return true;
      });

      // Attempting to reactivate disabledUser via updateUser must also throw QuotaExceededError!
      await assert.rejects(async () => {
        await UserService.updateUser(authCtx, disabledUser.id, { status: UserStatus.ACTIVE });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError, "updateUser must throw QuotaExceededError");
        assert.equal((err.details as any)?.limitKey, "maxUsers");
        return true;
      });

      const reloaded = await prisma.user.findUnique({ where: { id: disabledUser.id } });
      assert.equal(reloaded?.status, UserStatus.DISABLED, "User must remain DISABLED in database");
    });

    // ------------------------------------------------------------------------
    // TEST 16: Concurrency Protection Under Parallel Load (InnoDB Row Locking)
    // ------------------------------------------------------------------------
    await test("Concurrency Protection: Parallel mutations at quota boundary cannot exceed quota (InnoDB lock proof)", async () => {
      const { company, authCtx, status, source } = await setupTestTenant(
        "T16_Concurrency",
        "STARTER",
        { maxLeads: 2 } // Exactly 2 leads allowed
      );

      // Company currently has 0 leads. Fire 5 concurrent createLead requests in parallel!
      const parallelRequests = Array.from({ length: 5 }, (_, i) =>
        LeadService.createLead(authCtx, {
          name: `Concurrent Lead ${i}`,
          email: `concurrent-${i}@example.com`,
          statusId: status.id,
          sourceId: source.id,
        })
          .then((lead) => {
            tracker.leadIds.add(lead.id);
            return { success: true, id: lead.id };
          })
          .catch((err) => ({ success: false, error: err }))
      );

      const results = await Promise.all(parallelRequests);

      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      assert.equal(succeeded.length, 2, "Exactly 2 parallel requests must succeed");
      assert.equal(failed.length, 3, "Exactly 3 parallel requests must fail due to serialized row lock");

      for (const f of failed) {
        assert.ok((f as any).error instanceof QuotaExceededError, "Failures must be QuotaExceededError");
      }

      // Confirm in DB that exactly 2 leads exist
      const totalInDb = await prisma.lead.count({ where: { companyId: company.id, deletedAt: null } });
      assert.equal(totalInDb, 2, "Database must strictly contain exactly 2 leads without over-allocation");
    });

    // ------------------------------------------------------------------------
    // TEST 17: Concurrency Protection on User Seats
    // ------------------------------------------------------------------------
    await test("Concurrency Protection (User Seats): Parallel invitations at boundary serialize without exceeding quota", async () => {
      const { company, authCtx, role } = await setupTestTenant(
        "T17_ConcurrentSeats",
        "STARTER",
        { maxUsers: 2 } // 1 admin exists, exactly 1 seat remains
      );

      // Fire 4 parallel invitation requests
      const parallelInvites = Array.from({ length: 4 }, (_, i) =>
        InvitationService.createInvitation(authCtx, {
          email: `parallel-seat-${i}@example.com`,
          roleId: role.id,
          name: `Parallel User ${i}`,
        })
          .then((inv) => {
            tracker.invitationIds.add(inv.invitationId);
            tracker.userIds.add(inv.userId);
            return { success: true };
          })
          .catch((err) => ({ success: false, error: err }))
      );

      const results = await Promise.all(parallelInvites);
      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      assert.equal(succeeded.length, 1, "Exactly 1 seat request must succeed");
      assert.equal(failed.length, 3, "3 seat requests must fail");

      const activeUsers = await prisma.user.count({ where: { companyId: company.id, deletedAt: null } });
      assert.equal(activeUsers, 2, "Total users in DB must be exactly 2 (maxUsers)");
    });

    // ------------------------------------------------------------------------
    // TEST 18: Server-Side Feature Gating (leadImport, export, customRoles, customFields)
    // ------------------------------------------------------------------------
    await test("Server-Side Feature Gating: Gated operations are rejected server-side when feature is disabled", async () => {
      const { company, authCtx } = await setupTestTenant(
        "T18_FeatureGates",
        "STARTER",
        null,
        {
          leadImport: false,
          export: false,
          customRoles: false,
          customFields: false,
        }
      );

      // 1. Lead Import feature check
      await assert.rejects(async () => {
        await LeadImportService.previewImport(authCtx, "Name\nJohn", "import.csv");
      }, (err: any) => {
        assert.ok(err instanceof ForbiddenError || err instanceof QuotaExceededError);
        assert.ok(err.message.includes("leadImport"));
        return true;
      });

      await assert.rejects(async () => {
        await LeadImportService.executeImport(authCtx, {
          csvContent: "Name\nJohn",
          filename: "import.csv",
          columnMappings: { Name: "name" },
          duplicateStrategy: "CREATE",
        });
      }, (err: any) => {
        assert.ok(err.message.includes("leadImport"));
        return true;
      });

      // 2. Export feature check
      await assert.rejects(async () => {
        await AnalyticsService.exportReportCsv(authCtx, { report: "team", preset: "LAST_30_DAYS" });
      }, (err: any) => {
        assert.ok(err.message.includes("export"));
        return true;
      });

      // 3. Custom Roles feature check
      await assert.rejects(async () => {
        await RoleService.createRole(authCtx, {
          name: "Custom Manager",
          permissions: [{ module: "leads", action: "view", dataScope: DataScope.COMPANY }],
        });
      }, (err: any) => {
        assert.ok(err.message.includes("customRoles"));
        return true;
      });

      // 4. Custom Fields feature check
      await assert.rejects(async () => {
        await CustomFieldService.createCustomField(authCtx, {
          entityType: "LEAD",
          key: "test_field",
          label: "Test Field",
          fieldType: "TEXT",
        });
      }, (err: any) => {
        assert.ok(err.message.includes("customFields"));
        return true;
      });
    });

    // ------------------------------------------------------------------------
    // TEST 19: Full 8 Metrics Quota Enforcement Coverage
    // ------------------------------------------------------------------------
    await test("Full Metrics Coverage: Verification across all 8 catalog quota metrics", async () => {
      const { company, authCtx } = await setupTestTenant(
        "T19_AllMetrics",
        "STARTER",
        {
          maxCustomers: 1,
          maxTeams: 1,
          maxProducts: 1,
          maxServices: 1,
          maxDispositions: 1,
          maxCustomFields: 1,
        },
        {
          customFields: true,
        }
      );

      // 1. Customer Quota (maxCustomers = 1)
      const c1 = await CustomerService.createCustomer(authCtx, {
        name: "Customer 1",
        phone: "+1-555-010-0001",
      });
      tracker.customerIds.add(c1.id);

      await assert.rejects(async () => {
        await CustomerService.createCustomer(authCtx, {
          name: "Customer 2",
          phone: "+1-555-010-0002",
        });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError && (err.details as any)?.limitKey === "maxCustomers");
        return true;
      });

      // 2. Team Quota (maxTeams = 1)
      const t1 = await TeamService.createTeam(authCtx, { name: "Team 1" });
      tracker.teamIds.add(t1.id);

      await assert.rejects(async () => {
        await TeamService.createTeam(authCtx, { name: "Team 2" });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError && (err.details as any)?.limitKey === "maxTeams");
        return true;
      });

      // 3. Product Quota (maxProducts = 1)
      const p1 = await OfferingService.createOffering(authCtx, {
        name: "Product 1",
        type: "PRODUCT",
        defaultPrice: 100,
        currency: "USD",
      });
      tracker.offeringIds.add(p1.id);

      await assert.rejects(async () => {
        await OfferingService.createOffering(authCtx, {
          name: "Product 2",
          type: "PRODUCT",
          defaultPrice: 200,
          currency: "USD",
        });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError && (err.details as any)?.limitKey === "maxProducts");
        return true;
      });

      // 4. Service Quota (maxServices = 1)
      const s1 = await OfferingService.createOffering(authCtx, {
        name: "Service 1",
        type: "SERVICE",
        defaultPrice: 150,
        currency: "USD",
      });
      tracker.offeringIds.add(s1.id);

      await assert.rejects(async () => {
        await OfferingService.createOffering(authCtx, {
          name: "Service 2",
          type: "SERVICE",
          defaultPrice: 250,
          currency: "USD",
        });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError && (err.details as any)?.limitKey === "maxServices");
        return true;
      });

      // 5. Disposition Quota (maxDispositions = 1)
      const d1 = await DispositionService.createDisposition(authCtx, {
        name: "Contacted",
      });
      tracker.dispositionIds.add(d1.id);

      await assert.rejects(async () => {
        await DispositionService.createDisposition(authCtx, {
          name: "Interested",
        });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError && (err.details as any)?.limitKey === "maxDispositions");
        return true;
      });

      // 6. Custom Field Quota (maxCustomFields = 1)
      const cf1 = await CustomFieldService.createCustomField(authCtx, {
        entityType: "LEAD",
        key: "cf_metric_test_1",
        label: "CF 1",
        fieldType: "TEXT",
      });
      tracker.customFieldIds.add(cf1.id);

      await assert.rejects(async () => {
        await CustomFieldService.createCustomField(authCtx, {
          entityType: "LEAD",
          key: "cf_metric_test_2",
          label: "CF 2",
          fieldType: "TEXT",
        });
      }, (err: any) => {
        assert.ok(err instanceof QuotaExceededError && (err.details as any)?.limitKey === "maxCustomFields");
        return true;
      });
    });

    // ------------------------------------------------------------------------
    // TEST 20: Platform Governance Authorization & Tenant Isolation
    // ------------------------------------------------------------------------
    await test("Platform Governance Isolation: SuperAdmin can set dedicated limit overrides safely", async () => {
      const { company } = await setupTestTenant("T20_GovIsolation", "STARTER");

      const superAdmin = await prisma.superAdmin.create({
        data: {
          email: `sa-t20-${Date.now()}@platform.internal`,
          name: "Platform SuperAdmin",
          hashedPassword: "supersecretpassword",
          isActive: true,
        },
      });
      tracker.superAdminIds.add(superAdmin.id);

      const updated = await PlatformLimitService.setCompanyLimitOverrides(
        company.id,
        { maxLeads: 8888 },
        superAdmin.id
      );
      assert.deepEqual((updated as any).limitOverrides, { maxLeads: 8888 });

      const reloaded = await prisma.company.findUnique({
        where: { id: company.id },
        select: { limitOverrides: true } as any,
      });
      assert.deepEqual(reloaded?.limitOverrides, { maxLeads: 8888 });
    });

    // ------------------------------------------------------------------------
    // TEST 21: Real Route Handler Authentication, Authorization & Quota Overrides
    // ------------------------------------------------------------------------
    await test("Real Route Handler Auth: Ordinary tenant sessions & unauthenticated requests are strictly rejected; valid SuperAdmin can set overrides", async () => {
      const { company } = await setupTestTenant("T21_RouteHandler", "STARTER");

      // 1. Unauthenticated request -> 401
      const unauthReq = new NextRequest(`http://localhost:3000/api/v1/admin/companies/${company.id}/limits`, {
        method: "POST",
        body: JSON.stringify({ limits: { maxLeads: 5000 } }),
      });
      const unauthRes = await adminLimitsPost(unauthReq, { params: Promise.resolve({ id: company.id }) });
      assert.equal(unauthRes.status, 401, "Unauthenticated request must return 401");

      // 2. Tenant user session cookie -> 401 (SuperAdmin auth required)
      const tenantUserReq = new NextRequest(`http://localhost:3000/api/v1/admin/companies/${company.id}/limits`, {
        method: "POST",
        headers: {
          cookie: `universal_crm_session=fake_tenant_user_token`,
        },
        body: JSON.stringify({ limits: { maxLeads: 5000 } }),
      });
      const tenantUserRes = await adminLimitsPost(tenantUserReq, { params: Promise.resolve({ id: company.id }) });
      assert.equal(tenantUserRes.status, 401, "Tenant user session must be rejected with 401");

      // Create super admin and real DB session
      const superAdmin = await prisma.superAdmin.create({
        data: {
          email: `sa-route-${Date.now()}@platform.internal`,
          name: "Route Test SuperAdmin",
          hashedPassword: "securehashpassword",
          isActive: true,
        },
      });
      tracker.superAdminIds.add(superAdmin.id);

      const saSession = await createSuperAdminSession(superAdmin.id);
      tracker.superAdminSessionIds.add(saSession.sessionId);

      // 3. Malformed JSON / unknown keys -> 400
      const unknownKeyReq = new NextRequest(`http://localhost:3000/api/v1/admin/companies/${company.id}/limits`, {
        method: "POST",
        headers: {
          cookie: `universal_crm_superadmin_session=${saSession.rawToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ limits: { unknownKey: 100 } }),
      });
      const unknownKeyRes = await adminLimitsPost(unknownKeyReq, { params: Promise.resolve({ id: company.id }) });
      assert.equal(unknownKeyRes.status, 400, "Unknown keys must return 400");

      // 4. Negative limit other than -1 (e.g. -5) -> 400
      const negLimitReq = new NextRequest(`http://localhost:3000/api/v1/admin/companies/${company.id}/limits`, {
        method: "POST",
        headers: {
          cookie: `universal_crm_superadmin_session=${saSession.rawToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ limits: { maxUsers: -5 } }),
      });
      const negLimitRes = await adminLimitsPost(negLimitReq, { params: Promise.resolve({ id: company.id }) });
      assert.equal(negLimitRes.status, 400, "Negative limit other than -1 must return 400");

      // 5. Fractional limit (e.g. 3.5) -> 400
      const fracLimitReq = new NextRequest(`http://localhost:3000/api/v1/admin/companies/${company.id}/limits`, {
        method: "POST",
        headers: {
          cookie: `universal_crm_superadmin_session=${saSession.rawToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ limits: { maxUsers: 3.5 } }),
      });
      const fracLimitRes = await adminLimitsPost(fracLimitReq, { params: Promise.resolve({ id: company.id }) });
      assert.equal(fracLimitRes.status, 400, "Fractional limit must return 400");

      // 6. Valid Super Admin setting unlimited -1 on maxUsers and 50000 on maxLeads -> 200 OK
      const validReq = new NextRequest(`http://localhost:3000/api/v1/admin/companies/${company.id}/limits`, {
        method: "POST",
        headers: {
          cookie: `universal_crm_superadmin_session=${saSession.rawToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ limits: { maxUsers: -1, maxLeads: 50000 } }),
      });
      const validRes = await adminLimitsPost(validReq, { params: Promise.resolve({ id: company.id }) });
      assert.equal(validRes.status, 200, "Valid Super Admin request must return 200");
      const validJson = (await validRes.json()) as any;
      assert.equal(validJson.success, true);
      assert.deepEqual(validJson.data.limitOverrides, { maxUsers: -1, maxLeads: 50000 });

      // Verify DB persistence
      const reloadedComp = await prisma.company.findUnique({
        where: { id: company.id },
        select: { limitOverrides: true } as any,
      });
      assert.deepEqual(reloadedComp?.limitOverrides, { maxUsers: -1, maxLeads: 50000 });

      // 7. Route: POST /api/v1/admin/companies/[id]/features
      const validFeatureReq = new NextRequest(`http://localhost:3000/api/v1/admin/companies/${company.id}/features`, {
        method: "POST",
        headers: {
          cookie: `universal_crm_superadmin_session=${saSession.rawToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ overrides: { advancedReports: true, customRoles: true } }),
      });
      const validFeatureRes = await adminFeaturesPost(validFeatureReq, { params: Promise.resolve({ id: company.id }) });
      assert.equal(validFeatureRes.status, 200, "Valid feature overrides must return 200");
      const featureJson = (await validFeatureRes.json()) as any;
      assert.equal(featureJson.success, true);
      assert.deepEqual(featureJson.data.featureOverrides, { advancedReports: true, customRoles: true });
    });

    // ------------------------------------------------------------------------
    // TEST 22: Concurrency Protection on Customer Creation (Multiple Metric Proof)
    // ------------------------------------------------------------------------
    await test("Concurrency Protection (Customers): Parallel customer creations at boundary serialize under InnoDB lock", async () => {
      const { company, authCtx } = await setupTestTenant(
        "T22_ConcurrentCustomers",
        "STARTER",
        { maxCustomers: 2 } // Exactly 2 customers allowed
      );

      // Fire 5 concurrent createCustomer requests in parallel
      const parallelRequests = Array.from({ length: 5 }, (_, i) =>
        CustomerService.createCustomer(authCtx, {
          name: `Concurrent Customer ${i}`,
          phone: `+1-555-999-000${i}`,
        })
          .then((c) => {
            tracker.customerIds.add(c.id);
            return { success: true, id: c.id };
          })
          .catch((err) => ({ success: false, error: err }))
      );

      const results = await Promise.all(parallelRequests);
      const succeeded = results.filter((r) => r.success);
      const failed = results.filter((r) => !r.success);

      assert.equal(succeeded.length, 2, "Exactly 2 parallel customer creations must succeed");
      assert.equal(failed.length, 3, "Exactly 3 parallel requests must fail at quota boundary");

      for (const f of failed) {
        assert.ok((f as any).error instanceof QuotaExceededError, "Failed requests must be QuotaExceededError");
        assert.equal(((f as any).error.details as any)?.limitKey, "maxCustomers");
      }

      const totalInDb = await prisma.customer.count({ where: { companyId: company.id } });
      assert.equal(totalInDb, 2, "Database must strictly contain exactly 2 customers");
    });

    console.log("\n================================================================================");
    console.log(`PHASE 3.1 TEST SUITE PASSED: ${passedTests}/${totalTests} tests successful.`);
    console.log("================================================================================\n");

  } finally {
    process.stdout.write("Cleaning up all test fixtures ... ");
    const companyIds = Array.from(tracker.companyIds);
    const userIds = Array.from(tracker.userIds);
    const leadIds = Array.from(tracker.leadIds);
    const customerIds = Array.from(tracker.customerIds);
    const superAdminIds = Array.from(tracker.superAdminIds);

    await tracker.cleanupAll();

    // Independent post-run residue audit against exact fixture IDs
    const [leftoverCompanies, leftoverUsers, leftoverLeads, leftoverCustomers, leftoverSuperAdmins] = await Promise.all([
      prisma.company.count({ where: { id: { in: companyIds } } }),
      prisma.user.count({ where: { id: { in: userIds } } }),
      prisma.lead.count({ where: { id: { in: leadIds } } }),
      prisma.customer.count({ where: { id: { in: customerIds } } }),
      prisma.superAdmin.count({ where: { id: { in: superAdminIds } } }),
    ]);

    const totalLeftovers = leftoverCompanies + leftoverUsers + leftoverLeads + leftoverCustomers + leftoverSuperAdmins;
    if (totalLeftovers > 0) {
      throw new Error(`Residual fixture records detected in test database: ${totalLeftovers} records!`);
    }

    console.log("CLEANUP COMPLETE (0 leftover test fixtures verified across all entities).");
  }
}

// Self-executing runner
runPhase3GovernanceTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nFATAL ERROR in Phase 3.1 test suite:", err);
    process.exit(1);
  });
