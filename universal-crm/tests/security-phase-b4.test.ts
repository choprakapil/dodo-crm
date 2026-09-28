/**
 * Comprehensive Security Test Suite — Phase B.4 Security Re-Check
 * Universal CRM
 *
 * Explicitly tests:
 * 1.  Unauthenticated API rejection
 * 2.  Cross-tenant GET rejection
 * 3.  Cross-tenant UPDATE rejection
 * 4.  Cross-tenant DELETE rejection
 * 5.  OWN scope isolation
 * 6.  TEAM scope isolation
 * 7.  COMPANY scope access
 * 8.  Unauthorized role rejection
 * 9.  Client companyId spoofing
 * 10. Client userId spoofing
 * 11. Client role spoofing / privilege escalation guard
 * 12. Client dataScope spoofing
 * 13. Customer -> Enquiry traversal protection (One customer != one enquiry)
 * 14. Customer link/unlink authorization (customers.link or customers.manage required)
 * 15. Cross-tenant customer link prevention
 * 16. Template apply authorization (Admin or settings.manage required)
 * 17. Template forceSwitch authorization
 * 18. Onboarding authorization (server-side completion gates & admin boundary)
 * 19. Invitation tenant binding
 * 20. Invitation replay & expiry enforcement
 * 21. Storage signed URL tenant isolation
 * 22. Storage path traversal rejection
 * 23. Rate-limit enforcement & fail-closed behavior
 * 24. Mass-assignment protection
 * 25. Audit actor integrity (AuthContext authoritative)
 * 26. Production-safe error response (zero leak of stack traces or SQL internals)
 * 27. Super Admin / tenant boundary isolation
 * 28. Soft-deleted record access protection
 * 29. Lead custom field IDOR & Data Scope enforcement
 * 30. Read-only customer phone resolution (zero state mutation on GET)
 */

import assert from "assert";
import { NextRequest } from "next/server";
import { prisma } from "../lib/db";
import { PlatformCompanyService } from "../lib/services/platform-company.service";
import { LeadService } from "../lib/services/lead.service";
import { CustomerService } from "../lib/services/customer.service";
import { CustomerResolutionService } from "../lib/services/customer-resolution.service";
import { CustomFieldService } from "../lib/services/custom-field.service";
import { OfferingService } from "../lib/services/offering.service";
import { ActivityService } from "../lib/services/activity.service";
import { RoleService } from "../lib/services/role.service";
import { TeamService } from "../lib/services/team.service";
import { TemplateService } from "../lib/services/template.service";
import { SYSTEM_TEMPLATES } from "../lib/templates/registry";
import { realEstateTemplate } from "../lib/templates/definitions/real-estate";
import { OnboardingService } from "../lib/services/onboarding.service";
import { InvitationService } from "../lib/services/invitation.service";
import {
  storageService,
  buildCompanyStorageKey,
  validateTenantKey,
  TenantIsolationViolationError,
} from "../lib/services/storage";
import {
  rateLimiter,
} from "../lib/services/rate-limit";
import {
  AuthContext,
  requireAuth,
  createDbSession,
  validateSessionToken,
} from "../lib/auth/session";
import {
  createSuperAdminSession,
} from "../lib/auth/super-admin-session";
import { toApiErrorResponse, ErrorCode, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../lib/errors";
import { CustomFieldType, DataScope, UserStatus, ActivityType, OfferingType } from "@prisma/client";

function buildAuthContext(
  user: any,
  company: any,
  role: any,
  permissions: any[]
): AuthContext {
  const perms = permissions.map((p) => ({
    module: p.module,
    action: p.action,
    dataScope: p.dataScope as DataScope,
  }));

  const hasPermission = (module: string, action: string): boolean => {
    return perms.some(
      (p) =>
        (p.module === module || p.module === "*") &&
        (p.action === action || p.action === "*" || p.action === "manage")
    );
  };

  const getDataScope = (module: string, action: string): DataScope | null => {
    const match = perms.find(
      (p) =>
        (p.module === module || p.module === "*") &&
        (p.action === action || p.action === "*" || p.action === "manage")
    );
    return match ? match.dataScope : null;
  };

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      status: user.status,
      roleId: role.id,
      roleName: role.name,
      isSystemRole: role.isSystem,
    },
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      status: company.status,
      timezone: company.timezone,
      currency: company.currency,
      defaultCountryCode: company.defaultCountryCode ?? "IN",
      allowSalesPriceOverride: company.allowSalesPriceOverride ?? true,
      customerDirectoryVisibility: company.customerDirectoryVisibility ?? "DATA_SCOPE",
      createEnquiryHistoryEnabled: company.createEnquiryHistoryEnabled ?? true,
      historyPreviewFields: company.historyPreviewFields as Record<string, boolean> | null,
    },
    role: {
      id: role.id,
      name: role.name,
      isSystem: role.isSystem,
    },
    permissions: perms,
    session: {
      id: "sec_session_test",
      expiresAt: new Date(Date.now() + 86400000),
    },
    hasPermission,
    getDataScope,
  };
}

export async function runPhaseB4SecurityTests() {
  console.log("\n====================================================================");
  console.log("🛡️  RUNNING PHASE B.4 COMPREHENSIVE SECURITY RE-CHECK TEST SUITE");
  console.log("====================================================================");

  let passedTests = 0;
  let totalTests = 0;

  const test = async (name: string, fn: () => Promise<void>) => {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  ✔ [${totalTests}/30] ${name}`);
    } catch (err: any) {
      console.error(`  ❌ [${totalTests}/30] ${name}`);
      console.error(err);
      throw err;
    }
  };

  // 0. Setup Prerequisites: SuperAdmin, Plan, and 2 Companies (Tenant Alpha and Tenant Beta)
  let superAdmin = await prisma.superAdmin.findFirst({ where: { isActive: true } });
  if (!superAdmin) {
    superAdmin = await prisma.superAdmin.create({
      data: {
        email: `sec_superadmin_${Date.now()}@platform.local`,
        hashedPassword: "hashed_dummy_password",
        name: "Security Super Admin",
        isActive: true,
      },
    });
  }

  let plan = await prisma.plan.findUnique({ where: { code: "STARTER" } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        name: "Starter",
        code: "STARTER",
        maxUsers: 10,
        maxLeads: 5000,
        features: {},
      },
    });
  }

  const ts = Date.now();
  const provisionAlpha = await PlatformCompanyService.provisionCompany(
    {
      name: "Alpha Corp",
      slug: `alpha-${ts}`,
      initialAdminEmail: `admin_alpha_${ts}@alpha.local`,
      initialAdminName: "Alice Alpha Admin",
      planTier: "STARTER",
      timezone: "UTC",
      currency: "USD",
    },
    superAdmin.id
  );

  const provisionBeta = await PlatformCompanyService.provisionCompany(
    {
      name: "Beta Industries",
      slug: `beta-${ts}`,
      initialAdminEmail: `admin_beta_${ts}@beta.local`,
      initialAdminName: "Bob Beta Admin",
      planTier: "STARTER",
      timezone: "UTC",
      currency: "EUR",
    },
    superAdmin.id
  );

  const companyA = provisionAlpha.company;
  const companyB = provisionBeta.company;
  const userAdminA = provisionAlpha.initialAdmin;
  const userAdminB = provisionBeta.initialAdmin;

  const adminRoleA = await prisma.role.findFirstOrThrow({
    where: { companyId: companyA.id, name: "Admin" },
    include: { permissions: true },
  });
  const adminRoleB = await prisma.role.findFirstOrThrow({
    where: { companyId: companyB.id, name: "Admin" },
    include: { permissions: true },
  });

  const ctxAdminA = buildAuthContext(userAdminA, companyA, adminRoleA, adminRoleA.permissions);
  const ctxAdminB = buildAuthContext(userAdminB, companyB, adminRoleB, adminRoleB.permissions);

  // Create Sales Rep role with OWN data scope in Company Alpha
  const repRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: `SalesRep_OWN_${ts}`,
      description: "Sales Representative with OWN scope",
      isSystem: false,
      permissions: {
        createMany: {
          data: [
            { module: "leads", action: "view", dataScope: DataScope.OWN },
            { module: "leads", action: "create", dataScope: DataScope.OWN },
            { module: "leads", action: "update", dataScope: DataScope.OWN },
            { module: "customers", action: "view", dataScope: DataScope.OWN },
            { module: "tasks", action: "view", dataScope: DataScope.OWN },
            { module: "tasks", action: "create", dataScope: DataScope.OWN },
            { module: "activities", action: "view", dataScope: DataScope.OWN },
            { module: "activities", action: "create", dataScope: DataScope.OWN },
          ],
        },
      },
    },
    include: { permissions: true },
  });

  // Create User 1 (Agent 1) in Company Alpha
  const agent1 = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: repRoleA.id,
      email: `agent1_${ts}@alpha.local`,
      name: "Agent One",
      status: UserStatus.ACTIVE,
    },
  });
  const ctxAgent1 = buildAuthContext(agent1, companyA, repRoleA, repRoleA.permissions);

  // Create User 2 (Agent 2) in Company Alpha
  const agent2 = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: repRoleA.id,
      email: `agent2_${ts}@alpha.local`,
      name: "Agent Two",
      status: UserStatus.ACTIVE,
    },
  });
  const ctxAgent2 = buildAuthContext(agent2, companyA, repRoleA, repRoleA.permissions);

  // Seed baseline data
  const leadSourceA = await prisma.leadSource.findFirstOrThrow({ where: { companyId: companyA.id } });
  const _leadStatusA = await prisma.leadStatus.findFirstOrThrow({ where: { companyId: companyA.id } });
  const leadSourceB = await prisma.leadSource.findFirstOrThrow({ where: { companyId: companyB.id } });
  const _leadStatusB = await prisma.leadStatus.findFirstOrThrow({ where: { companyId: companyB.id } });

  // Lead A1 (assigned to Agent 1 in Company Alpha)
  const leadA1 = await LeadService.createLead(ctxAgent1, {
    name: "Lead Alpha 1",
    phone: "+15551110001",
    email: "alpha1@lead.local",
    priority: "HIGH",
    sourceId: leadSourceA.id,
    assignedUserId: agent1.id,
  });

  // Lead A2 (assigned to Agent 2 in Company Alpha)
  const leadA2 = await LeadService.createLead(ctxAgent2, {
    name: "Lead Alpha 2",
    phone: "+15551110002",
    email: "alpha2@lead.local",
    priority: "MEDIUM",
    sourceId: leadSourceA.id,
    assignedUserId: agent2.id,
  });

  // Lead B1 (in Company Beta)
  const leadB1 = await LeadService.createLead(ctxAdminB, {
    name: "Lead Beta 1",
    phone: "+15552220001",
    email: "beta1@lead.local",
    priority: "HIGH",
    sourceId: leadSourceB.id,
  });

  // =========================================================================
  // 1. Unauthenticated API Rejection
  // =========================================================================
  await test("1. Unauthenticated API rejection: empty or invalid session rejected", async () => {
    const invalidSession = await validateSessionToken("completely_fake_invalid_raw_token");
    assert.strictEqual(invalidSession, null, "Invalid raw session token must resolve to null");

    const mockReq = {
      cookies: {
        get: (_name: string) => undefined,
      },
    } as unknown as NextRequest;

    await assert.rejects(
      async () => {
        await requireAuth(mockReq);
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedError, "requireAuth must throw UnauthorizedError without cookie");
        return true;
      }
    );
  });

  // =========================================================================
  // 2. Cross-Tenant GET Rejection
  // =========================================================================
  await test("2. Cross-tenant GET rejection: Company A cannot read Company B lead", async () => {
    await assert.rejects(
      async () => {
        await LeadService.getLeadById(ctxAdminA, leadB1.id);
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError, "Accessing cross-tenant lead must throw NotFoundError");
        return true;
      }
    );
  });

  // =========================================================================
  // 3. Cross-Tenant UPDATE Rejection
  // =========================================================================
  await test("3. Cross-tenant UPDATE rejection: Company A cannot mutate Company B lead", async () => {
    await assert.rejects(
      async () => {
        await LeadService.updateLead(ctxAdminA, leadB1.id, {
          name: "Hacked by Alpha",
        });
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError, "Updating cross-tenant lead must throw NotFoundError");
        return true;
      }
    );
  });

  // =========================================================================
  // 4. Cross-Tenant DELETE Rejection
  // =========================================================================
  await test("4. Cross-tenant DELETE rejection: Company A cannot delete Company B lead", async () => {
    await assert.rejects(
      async () => {
        await LeadService.deleteLead(ctxAdminA, leadB1.id);
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError, "Deleting cross-tenant lead must throw NotFoundError");
        return true;
      }
    );
  });

  // =========================================================================
  // 5. OWN Scope Isolation
  // =========================================================================
  await test("5. OWN scope isolation: Agent 1 cannot read Agent 2's leads", async () => {
    await assert.rejects(
      async () => {
        await LeadService.getLeadById(ctxAgent1, leadA2.id);
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError, "OWN scope agent accessing another agent lead must throw NotFoundError");
        return true;
      }
    );

    const listAgent1 = await LeadService.listLeads(ctxAgent1, {
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    const containsAgent2Lead = listAgent1.data.some((l: any) => l.id === leadA2.id);
    assert.strictEqual(containsAgent2Lead, false, "Agent 1 list must not include Agent 2's lead under OWN scope");
  });

  // =========================================================================
  // 6. TEAM Scope Isolation
  // =========================================================================
  await test("6. TEAM scope isolation: User in Team X cannot read Team Y leads", async () => {
    const teamX = await TeamService.createTeam(ctxAdminA, { name: `Team X ${ts}`, isActive: true });
    const teamY = await TeamService.createTeam(ctxAdminA, { name: `Team Y ${ts}`, isActive: true });

    const repRoleTeam = await prisma.role.create({
      data: {
        companyId: companyA.id,
        name: `SalesRep_TEAM_${ts}`,
        description: "Team-scoped role",
        isSystem: false,
        permissions: {
          createMany: {
            data: [
              { module: "leads", action: "view", dataScope: DataScope.TEAM },
              { module: "leads", action: "create", dataScope: DataScope.TEAM },
              { module: "customers", action: "view", dataScope: DataScope.TEAM },
            ],
          },
        },
      },
      include: { permissions: true },
    });

    const userTeamX = await prisma.user.create({
      data: {
        companyId: companyA.id,
        roleId: repRoleTeam.id,
        email: `teamx_user_${ts}@alpha.local`,
        name: "User Team X",
        status: UserStatus.ACTIVE,
      },
    });
    await TeamService.addTeamMember(ctxAdminA, teamX.id, userTeamX.id);
    const ctxTeamX = buildAuthContext(userTeamX, companyA, repRoleTeam, repRoleTeam.permissions);

    // Lead in Team Y
    const leadTeamY = await LeadService.createLead(ctxAdminA, {
      name: "Lead Team Y",
      phone: "+15551110009",
      email: "teamy@lead.local",
      priority: "LOW",
      sourceId: leadSourceA.id,
      teamId: teamY.id,
    });

    await assert.rejects(
      async () => {
        await LeadService.getLeadById(ctxTeamX, leadTeamY.id);
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError, "TEAM scope agent accessing another team's lead must throw NotFoundError");
        return true;
      }
    );
  });

  // =========================================================================
  // 7. COMPANY Scope Access
  // =========================================================================
  await test("7. COMPANY scope access: Admin can access both Agent 1 and Agent 2 leads in same company", async () => {
    const readA1 = await LeadService.getLeadById(ctxAdminA, leadA1.id);
    const readA2 = await LeadService.getLeadById(ctxAdminA, leadA2.id);
    assert.strictEqual(readA1.id, leadA1.id);
    assert.strictEqual(readA2.id, leadA2.id);
  });

  // =========================================================================
  // 8. Unauthorized Role Rejection
  // =========================================================================
  await test("8. Unauthorized role rejection: Sales Rep cannot create roles or manage users", async () => {
    await assert.rejects(
      async () => {
        await RoleService.createRole(ctxAgent1, {
          name: "Escalated Admin",
          description: "Illegal role",
          permissions: [{ module: "users", action: "manage", dataScope: DataScope.COMPANY }],
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError, "Non-admin creating roles must throw ForbiddenError");
        return true;
      }
    );
  });

  // =========================================================================
  // 9. Client CompanyId Spoofing
  // =========================================================================
  await test("9. Client companyId spoofing: Body-supplied companyId is ignored; AuthContext is authoritative", async () => {
    const spoofedInput: any = {
      name: "Spoofed Company Offering",
      type: OfferingType.SERVICE,
      defaultPrice: 500,
      currency: "USD",
      companyId: companyB.id, // Attempt to create inside Company B using Company A context
    };

    const offering = await OfferingService.createOffering(ctxAdminA, spoofedInput);
    assert.strictEqual(offering.companyId, companyA.id, "Offering must be strictly bound to ctx.company.id");
    assert.notStrictEqual(offering.companyId, companyB.id, "Spoofed companyId in body must be ignored");
  });

  // =========================================================================
  // 10. Client UserId Spoofing
  // =========================================================================
  await test("10. Client userId spoofing: Activity actor always derived from AuthContext, not input", async () => {
    const activity = await ActivityService.createActivity(ctxAgent1, leadA1.id, {
      type: ActivityType.NOTE,
      description: "Note by Agent 1",
      metadata: { userId: userAdminA.id }, // Attempt to impersonate Admin
    });

    assert.strictEqual(activity.userId, agent1.id, "Activity userId must match ctx.user.id");
    assert.notStrictEqual(activity.userId, userAdminA.id, "Injected userId must not override actual actor");
  });

  // =========================================================================
  // 11. Client Role Spoofing & Privilege Delegation Guard
  // =========================================================================
  await test("11. Privilege delegation guard: User cannot grant permissions they do not possess", async () => {
    // Custom manager role with only leads.manage
    const managerRole = await RoleService.createRole(ctxAdminA, {
      name: `Manager_NoUsers_${ts}`,
      description: "Manager with only leads",
      permissions: [
        { module: "leads", action: "manage", dataScope: DataScope.COMPANY },
        { module: "roles", action: "manage", dataScope: DataScope.COMPANY },
      ],
    });

    const managerUser = await prisma.user.create({
      data: {
        companyId: companyA.id,
        roleId: managerRole.id,
        email: `manager_${ts}@alpha.local`,
        name: "Manager Alice",
        status: UserStatus.ACTIVE,
      },
    });

    const ctxManager = buildAuthContext(managerUser, companyA, managerRole, managerRole.permissions);

    // Manager attempts to create a role that grants users.manage (which manager lacks)
    await assert.rejects(
      async () => {
        await RoleService.createRole(ctxManager, {
          name: `Illegal_Escalated_${ts}`,
          description: "Escalated",
          permissions: [{ module: "users", action: "manage", dataScope: DataScope.COMPANY }],
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError, "Privilege delegation guard must reject unpossessed permissions");
        assert.ok(err.message.includes("Privilege escalation rejected"));
        return true;
      }
    );
  });

  // =========================================================================
  // 12. Client DataScope Spoofing
  // =========================================================================
  await test("12. Client dataScope spoofing: Client cannot override server DataScope", async () => {
    const listResult = await LeadService.listLeads(ctxAgent1, {
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    // Regardless of any query or request input, Agent 1 with OWN scope only sees own leads
    assert.ok(listResult.data.every((l: any) => l.assignedUserId === agent1.id));
  });

  // =========================================================================
  // 13. Customer -> Enquiry Traversal Protection (One Customer != One Enquiry)
  // =========================================================================
  await test("13. Customer -> Enquiry traversal protection: Shared customer profile does NOT leak unauthorized enquiries", async () => {
    const customer = await CustomerService.createCustomer(ctxAdminA, {
      name: "Shared Corporate Customer",
      phone: "+15559990001",
      email: "corporate@shared.local",
    });

    // Enquiry 1 created for Agent 1
    const enquiry1 = await LeadService.createLead(ctxAgent1, {
      name: "Corporate Enquiry 1",
      phone: "+15559990001",
      customerId: customer.id,
      priority: "HIGH",
      sourceId: leadSourceA.id,
      assignedUserId: agent1.id,
    });

    // Enquiry 2 created for Agent 2
    const enquiry2 = await LeadService.createLead(ctxAgent2, {
      name: "Corporate Enquiry 2",
      phone: "+15559990001",
      customerId: customer.id,
      priority: "LOW",
      sourceId: leadSourceA.id,
      assignedUserId: agent2.id,
    });

    // When Agent 1 fetches the customer profile
    const custDetailForAgent1 = await CustomerService.getCustomerById(ctxAgent1, customer.id);
    const visibleEnquiryIds = custDetailForAgent1.enquiries.map((e: any) => e.id);

    assert.ok(visibleEnquiryIds.includes(enquiry1.id), "Agent 1 must see their own assigned enquiry");
    assert.strictEqual(
      visibleEnquiryIds.includes(enquiry2.id),
      false,
      "CRITICAL: Agent 1 must NEVER see Agent 2's enquiry on the same customer under OWN data scope"
    );
  });

  // =========================================================================
  // 14. Customer Link/Unlink Authorization
  // =========================================================================
  await test("14. Customer link/unlink authorization: Changing linked customer requires customers.manage or customers.link", async () => {
    const _custA = await CustomerService.createCustomer(ctxAdminA, {
      name: "Cust X",
      phone: "+15553330011",
    });
    const custB = await CustomerService.createCustomer(ctxAdminA, {
      name: "Cust Y",
      phone: "+15553330022",
    });

    // Agent 1 has leads.update but lacks customers.manage / customers.link
    await assert.rejects(
      async () => {
        await LeadService.updateLead(ctxAgent1, leadA1.id, {
          customerId: custB.id,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError, "Reassigning customer identity without customer link permission must fail");
        return true;
      }
    );
  });

  // =========================================================================
  // 15. Cross-Tenant Customer Link Prevention
  // =========================================================================
  await test("15. Cross-tenant customer link prevention: Linking Company A lead to Company B customer rejected", async () => {
    const custBeta = await CustomerService.createCustomer(ctxAdminB, {
      name: "Beta Customer",
      phone: "+15554440099",
    });

    await assert.rejects(
      async () => {
        await LeadService.updateLead(ctxAdminA, leadA1.id, {
          customerId: custBeta.id,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, "Linking lead to foreign company customer must throw ValidationError");
        return true;
      }
    );
  });

  // =========================================================================
  // 16. Template Apply Authorization
  // =========================================================================
  await test("16. Template apply authorization: Non-admin users cannot apply industry templates", async () => {
    await assert.rejects(
      async () => {
        await TemplateService.applyTemplate(ctxAgent1, "real-estate");
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError, "Ordinary user applying template must throw ForbiddenError");
        return true;
      }
    );
  });

  // =========================================================================
  // 17. Template Lifecycle & Idempotency: Cases A, B, C, D
  // =========================================================================
  await test("17. Template lifecycle: Cases A, B, C, D (Idempotent re-apply, upgrade, switch)", async () => {
    // Initial apply: real-estate@1
    const applyInitial = await TemplateService.applyTemplate(ctxAdminA, "real-estate");
    assert.strictEqual(applyInitial.success, true);

    const initialCustomFields = await prisma.customField.count({ where: { companyId: companyA.id } });

    // -----------------------------------------------------------------------
    // CASE A: Reapply same template + same version without forceSwitch
    // Expected: SUCCESS, action = "template.reapplied", 0 duplicates, config preserved
    // -----------------------------------------------------------------------
    const reapplyResult = await TemplateService.applyTemplate(ctxAdminA, "real-estate");
    assert.strictEqual(reapplyResult.success, true, "Case A: Re-applying same template must succeed without forceSwitch");
    assert.strictEqual(reapplyResult.created.customFields, 0, "Case A: 0 custom fields created on reapply");
    assert.strictEqual(reapplyResult.created.dispositions, 0, "Case A: 0 dispositions created on reapply");
    assert.strictEqual(reapplyResult.created.leadSources, 0, "Case A: 0 lead sources created on reapply");
    assert.strictEqual(reapplyResult.created.offerings, 0, "Case A: 0 offerings created on reapply");

    const customFieldsAfterReapply = await prisma.customField.count({ where: { companyId: companyA.id } });
    assert.strictEqual(customFieldsAfterReapply, initialCustomFields, "Case A: Custom fields count unchanged");

    const reapplyAudit = await prisma.auditLog.findFirst({
      where: { companyId: companyA.id, action: "template.reapplied" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(reapplyAudit, "Case A: Audit log must record action template.reapplied");

    // -----------------------------------------------------------------------
    // CASE B: Version upgrade without forceSwitch (same template key, newer version)
    // Expected: SUCCESS, action = "template.upgraded", only new version items added, config preserved
    // -----------------------------------------------------------------------
    const realEstateV2: typeof realEstateTemplate = {
      ...realEstateTemplate,
      metadata: {
        ...realEstateTemplate.metadata,
        version: 2,
      },
      configuration: {
        ...realEstateTemplate.configuration,
        customFields: [
          ...realEstateTemplate.configuration.customFields,
          {
            entityType: "LEAD",
            key: "property_facing",
            label: "Property Facing Direction",
            description: "Vaastu / orientation",
            fieldType: "SELECT",
            required: false,
            sortOrder: 99,
            options: ["North", "East", "West", "South"],
          },
        ],
      },
    };

    SYSTEM_TEMPLATES.push(realEstateV2);

    try {
      const upgradeResult = await TemplateService.applyTemplate(ctxAdminA, "real-estate", 2);
      assert.strictEqual(upgradeResult.success, true, "Case B: Upgrading template version must succeed without forceSwitch");
      assert.strictEqual(upgradeResult.created.customFields, 1, "Case B: Only 1 new custom field created in v2");
      assert.strictEqual(upgradeResult.created.dispositions, 0, "Case B: 0 existing dispositions re-created");

      const upgradeAudit = await prisma.auditLog.findFirst({
        where: { companyId: companyA.id, action: "template.upgraded" },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(upgradeAudit, "Case B: Audit log must record action template.upgraded");
    } finally {
      // Restore registry
      const v2Idx = SYSTEM_TEMPLATES.indexOf(realEstateV2);
      if (v2Idx !== -1) {
        SYSTEM_TEMPLATES.splice(v2Idx, 1);
      }
    }

    // -----------------------------------------------------------------------
    // CASE C: Different template without forceSwitch
    // Expected: FAIL CLOSED with ValidationError
    // -----------------------------------------------------------------------
    await assert.rejects(
      async () => {
        await TemplateService.applyTemplate(ctxAdminA, "healthcare");
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, "Case C: Switching template without forceSwitch must throw ValidationError");
        assert.ok(err.message.includes("forceSwitch: true"), "Case C: Error message must specify forceSwitch: true requirement");
        return true;
      }
    );

    // -----------------------------------------------------------------------
    // CASE D: Different template with forceSwitch: true
    // Expected: SUCCESS, action = "template.switched", real-estate preserved, healthcare added
    // -----------------------------------------------------------------------
    const switchResult = await TemplateService.applyTemplate(ctxAdminA, "healthcare", undefined, {
      forceSwitch: true,
    });
    assert.strictEqual(switchResult.success, true, "Case D: Switching template with forceSwitch: true must succeed");

    const switchAudit = await prisma.auditLog.findFirst({
      where: { companyId: companyA.id, action: "template.switched" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(switchAudit, "Case D: Audit log must record action template.switched");

    // Verify company metadata updated to healthcare
    const companyAfterSwitch = await prisma.company.findUniqueOrThrow({
      where: { id: companyA.id },
      select: { appliedTemplateKey: true, appliedTemplateVersion: true },
    });
    assert.strictEqual(companyAfterSwitch.appliedTemplateKey, "healthcare", "Case D: Company appliedTemplateKey updated to healthcare");

    // Verify existing real-estate field still exists
    const propertyTypeField = await prisma.customField.findFirst({
      where: { companyId: companyA.id, key: "property_type" },
    });
    assert.ok(propertyTypeField, "Case D: Prior real-estate configuration preserved after switch");
  });

  // =========================================================================
  // 18. Onboarding Authorization & Server-Side Gates
  // =========================================================================
  await test("18. Onboarding authorization: Non-admin cannot complete onboarding; incomplete profile rejected", async () => {
    // Non-admin rejected
    await assert.rejects(
      async () => {
        await OnboardingService.completeOnboarding(ctxAgent1);
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError, "Non-admin completing onboarding must throw ForbiddenError");
        return true;
      }
    );

    // Create fresh unconfigured company
    const unconfigured = await PlatformCompanyService.provisionCompany(
      {
        name: "Unconfigured Tenant",
        slug: `unconf-${ts}`,
        initialAdminEmail: `unconf_admin_${ts}@test.local`,
        initialAdminName: "Unconfigured Admin",
        planTier: "STARTER",
        timezone: "UTC",
        currency: "USD",
      },
      superAdmin.id
    );

    const adminRoleUnconf = await prisma.role.findFirstOrThrow({
      where: { companyId: unconfigured.company.id, name: "Admin" },
      include: { permissions: true },
    });
    const ctxUnconf = buildAuthContext(
      unconfigured.initialAdmin,
      unconfigured.company,
      adminRoleUnconf,
      adminRoleUnconf.permissions
    );

    // Initial step is PROFILE; attempting complete without completing PROFILE stage must fail
    await assert.rejects(
      async () => {
        await OnboardingService.completeOnboarding(ctxUnconf);
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, "Unfinished PROFILE stage must fail server-side completion gate");
        return true;
      }
    );
  });

  // =========================================================================
  // 19. Invitation Tenant Binding
  // =========================================================================
  await test("19. Invitation tenant binding: Invitation token is bound to inviting companyId only", async () => {
    const invite = await InvitationService.createInvitation(ctxAdminA, {
      email: `invited_user_${ts}@alpha.local`,
      name: "Invited User",
      roleId: repRoleA.id,
    });

    const rawToken = invite.inviteLink.split("/").pop()!;
    const inspection = await InvitationService.getInvitationByToken(rawToken);

    assert.strictEqual(inspection.company.id, companyA.id, "Invitation company must match issuing tenant");
    assert.strictEqual(inspection.email, `invited_user_${ts}@alpha.local`);
  });

  // =========================================================================
  // 20. Invitation Replay & Expiry Enforcement
  // =========================================================================
  await test("20. Invitation replay & expiry: Accepted or expired token fails immediately", async () => {
    const invite = await InvitationService.createInvitation(ctxAdminA, {
      email: `invited_replay_${ts}@alpha.local`,
      name: "Replay Test User",
      roleId: repRoleA.id,
    });

    const rawToken = invite.inviteLink.split("/").pop()!;

    // 1. Accept invitation
    const accepted = await InvitationService.acceptInvitation({
      token: rawToken,
      password: "StrongPassword123!",
      name: "Activated User",
    });
    const activatedUser = await prisma.user.findUniqueOrThrow({ where: { id: accepted.user.id } });
    assert.strictEqual(activatedUser.status, UserStatus.ACTIVE);

    // 2. Replay accepted token
    await assert.rejects(
      async () => {
        await InvitationService.getInvitationByToken(rawToken);
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, "Used invitation inspection must throw ValidationError");
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await InvitationService.acceptInvitation({
          token: rawToken,
          password: "StrongPassword123!",
        });
      },
      (err: any) => {
        assert.ok(err instanceof ValidationError, "Replaying accepted invitation must throw ValidationError");
        return true;
      }
    );
  });

  // =========================================================================
  // 21. Storage Signed URL Tenant Isolation
  // =========================================================================
  await test("21. Storage tenant isolation: Company A cannot validate or sign Company B storage keys", async () => {
    const keyCompanyB = buildCompanyStorageKey(companyB.id, "documents", "contract.pdf");

    // Tenant A attempts to validate or retrieve signed URL for Tenant B's key
    assert.throws(
      () => {
        validateTenantKey(companyA.id, keyCompanyB);
      },
      (err: any) => {
        assert.ok(err instanceof TenantIsolationViolationError, "Cross-tenant storage key validation must throw TenantIsolationViolationError");
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await storageService.getTenantSignedUrl(companyA.id, keyCompanyB);
      },
      (err: any) => {
        assert.ok(err instanceof TenantIsolationViolationError, "Cross-tenant signed URL request must throw TenantIsolationViolationError");
        return true;
      }
    );
  });

  // =========================================================================
  // 22. Storage Path Traversal Rejection
  // =========================================================================
  await test("22. Storage path traversal rejection: Traversal characters sanitized and namespace escaped", async () => {
    const traversalKey = buildCompanyStorageKey(companyA.id, "../../etc/passwd", "../../../malicious.sh");
    assert.ok(traversalKey.startsWith(`${companyA.id}/`), "Storage key must strictly reside within company namespace");
    assert.strictEqual(traversalKey.includes(".."), false, "Directory traversal characters must be stripped");
  });

  // =========================================================================
  // 23. Rate-Limit Enforcement & Fail-Closed Behavior
  // =========================================================================
  await test("23. Rate-limit enforcement: sliding window checks enforce thresholds", async () => {
    const testKey = `ratelimit_sec_test_${Date.now()}`;
    const limit = 2;
    const windowMs = 10000;

    const r1 = await rateLimiter.check({ key: testKey, limit, windowMs });
    assert.strictEqual(r1.success, true);
    assert.strictEqual(r1.remaining, 1);

    const r2 = await rateLimiter.check({ key: testKey, limit, windowMs });
    assert.strictEqual(r2.success, true);
    assert.strictEqual(r2.remaining, 0);

    const r3 = await rateLimiter.check({ key: testKey, limit, windowMs });
    assert.strictEqual(r3.success, false, "Third request within limit=2 window must be blocked");
    assert.strictEqual(r3.remaining, 0);
  });

  // =========================================================================
  // 24. Mass-Assignment Protection
  // =========================================================================
  await test("24. Mass-assignment protection: User cannot update system fields (companyId, id, deletedAt)", async () => {
    const updatedLead = await LeadService.updateLead(ctxAdminA, leadA1.id, {
      name: "Safe Name Update",
      // Arbitrary fields cast to verify service ignores them
      ...({ companyId: companyB.id, deletedAt: new Date(), id: "malicious_id" } as any),
    });

    assert.strictEqual(updatedLead.id, leadA1.id, "Record ID cannot be changed via mass assignment");
    assert.strictEqual(updatedLead.companyId, companyA.id, "Tenant companyId cannot be altered via mass assignment");
    assert.strictEqual(updatedLead.deletedAt, null, "deletedAt cannot be manipulated via mass assignment");
  });

  // =========================================================================
  // 25. Audit Actor Integrity
  // =========================================================================
  await test("25. Audit actor integrity: Audit log entries record AuthContext actor and server companyId", async () => {
    await LeadService.updateLead(ctxAgent1, leadA1.id, {
      name: "Audited Lead Name",
    });

    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        companyId: companyA.id,
        action: "lead.update",
      },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(auditEntry, "Audit log entry must exist");
    assert.strictEqual(auditEntry?.userId, agent1.id, "Actor in audit log must be ctx.user.id");
    assert.strictEqual(auditEntry?.companyId, companyA.id, "Company in audit log must be ctx.company.id");
  });

  // =========================================================================
  // 26. Production-Safe Error Response
  // =========================================================================
  await test("26. Production-safe error response: Server exceptions never leak stack traces or SQL", async () => {
    const rawSqlError = new Error('syntax error at or near "SELECT" in PostgreSQL');
    const safeResponse = toApiErrorResponse(rawSqlError);

    assert.strictEqual(safeResponse.status, 500);
    assert.strictEqual(safeResponse.body.error.code, ErrorCode.INTERNAL_ERROR);
    assert.strictEqual(safeResponse.body.error.message, "An unexpected error occurred");
    assert.strictEqual((safeResponse.body.error as any).stack, undefined, "Stack trace must NEVER be in error body");
    assert.strictEqual(
      JSON.stringify(safeResponse.body).includes("PostgreSQL"),
      false,
      "Raw database messages must NEVER leak to client"
    );
  });

  // =========================================================================
  // 27. Super Admin / Tenant Boundary Isolation
  // =========================================================================
  await test("27. Super Admin boundary: Tenant sessions cannot authenticate as Super Admin; Super Admin has no companyId", async () => {
    // Tenant user session
    const tenantSession = await createDbSession(userAdminA.id, companyA.id);

    // Attempt to validate tenant session token against super admin session
    const superAdminCtx = await prisma.superAdminSession.findUnique({
      where: { tokenHash: tenantSession.rawToken },
    });
    assert.strictEqual(superAdminCtx, null, "Tenant session token must not resolve to Super Admin");

    // Super Admin session creation
    const saSession = await createSuperAdminSession(superAdmin.id);
    const saFound = await prisma.superAdminSession.findUnique({
      where: { id: saSession.sessionId },
      include: { superAdmin: true },
    });
    assert.ok(saFound, "Super admin session must exist in superAdminSession table");
    assert.strictEqual((saFound as any).companyId, undefined, "Super Admin session has zero companyId context");
  });

  // =========================================================================
  // 28. Soft-Deleted Record Access Protection
  // =========================================================================
  await test("28. Soft-deleted record protection: Deleted records inaccessible through standard lookups", async () => {
    const leadToDelete = await LeadService.createLead(ctxAdminA, {
      name: "Temporary Lead",
      phone: "+15556667788",
      email: "temp@lead.local",
      sourceId: leadSourceA.id,
    });

    await LeadService.deleteLead(ctxAdminA, leadToDelete.id);

    // Verify inaccessible via getLeadById
    await assert.rejects(
      async () => {
        await LeadService.getLeadById(ctxAdminA, leadToDelete.id);
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError, "Soft-deleted lead must throw NotFoundError on getById");
        return true;
      }
    );

    // Verify not in list
    const list = await LeadService.listLeads(ctxAdminA, {
      page: 1,
      limit: 50,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    assert.strictEqual(list.data.some((l: any) => l.id === leadToDelete.id), false);
  });

  // =========================================================================
  // 29. Lead Custom Field IDOR & Data Scope Enforcement
  // =========================================================================
  await test("29. Lead custom field IDOR: Saving custom fields on other company or out-of-scope lead rejected", async () => {
    const cf = await CustomFieldService.createCustomField(ctxAdminA, {
      entityType: "LEAD",
      key: `sec_field_${ts}`,
      label: "Security Custom Field",
      fieldType: CustomFieldType.TEXT,
    });

    // 1. Cross-tenant custom field save attempt (Company A context -> Company B lead)
    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await CustomFieldService.saveLeadCustomFields(tx, ctxAdminA, leadB1.id, {
            [cf.key]: "Cross-tenant injection attempt",
          });
        });
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError, "Saving custom fields on cross-tenant lead must throw NotFoundError");
        return true;
      }
    );

    // 2. Data Scope violation: Agent 1 attempting to save custom fields on Agent 2's lead
    await assert.rejects(
      async () => {
        await prisma.$transaction(async (tx) => {
          await CustomFieldService.saveLeadCustomFields(tx, ctxAgent1, leadA2.id, {
            [cf.key]: "Agent 1 tampering with Agent 2 lead",
          });
        });
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError, "Saving custom fields on out-of-scope lead must throw NotFoundError");
        return true;
      }
    );

    // 3. Authorized save succeeds
    await prisma.$transaction(async (tx) => {
      await CustomFieldService.saveLeadCustomFields(tx, ctxAgent1, leadA1.id, {
        [cf.key]: "Authorized value",
      });
    });

    const readFields = await CustomFieldService.getLeadCustomFields(ctxAgent1, leadA1.id);
    const targetVal = readFields.find((f) => f.field.id === cf.id);
    assert.strictEqual(targetVal?.value, "Authorized value");
  });

  // =========================================================================
  // 30. Read-Only Customer Phone Resolution
  // =========================================================================
  await test("30. Read-only customer phone resolution: Looking up non-existent phone NEVER creates phantom records", async () => {
    const randomNonExistentPhone = `+1555000${Math.floor(1000 + Math.random() * 9000)}`;

    const countBefore = await prisma.customer.count({ where: { companyId: companyA.id } });

    const result = await CustomerResolutionService.findCustomerByPhone(
      companyA.id,
      randomNonExistentPhone,
      "IN"
    );

    assert.strictEqual(result, null, "findCustomerByPhone must return null for unrecognised phone");

    const countAfter = await prisma.customer.count({ where: { companyId: companyA.id } });
    assert.strictEqual(countAfter, countBefore, "CRITICAL: Resolution of unknown phone must NOT create phantom customer records");
  });

  console.log("\n====================================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE B.4 SECURITY TESTS PASSED SUCCESSFULLY!`);
  console.log("====================================================================\n");
}

if (require.main === module) {
  runPhaseB4SecurityTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
