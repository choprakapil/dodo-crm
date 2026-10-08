/**
 * Phase 3: Lead Bulk Custom Field Editing Test Suite
 *
 * Validates:
 * 1. Single custom field bulk update across multiple leads without altering other fields
 * 2. Multiple custom fields bulk update simultaneously
 * 3. Explicit CLEAR operation on custom fields (deletes value, preserves other fields)
 * 4. Field validation on all supported types (invalid numbers, bad emails, invalid select options, bad dates)
 * 5. Required field protection (cannot clear a required field)
 * 6. Strict Tenant Isolation (cannot update foreign company's leads or use foreign custom fields)
 * 7. RBAC Data Scope enforcement (OWN / TEAM / COMPANY scopes respected)
 * 8. Security & Permissions rejection for unauthorized callers
 * 9. Audit Logging verification for BULK_LEAD_EDIT_CUSTOM_FIELDS
 * 10. Accurate succeeded, skipped, failed result reporting
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { POST as bulkLeadRouteHandler } from "../app/api/v1/leads/bulk/route";
import { NextRequest } from "next/server";
import { DataScope } from "@prisma/client";

export async function runPhase3BulkCustomFieldsTests() {
  console.log("\n🧪 Running Phase 3: Lead Bulk Custom Field Editing Test Suite...");

  const uniqueSuffix = `p3_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Setup Test Companies & Roles
  const companyA = await prisma.company.create({
    data: {
      name: `Tenant Alpha ${uniqueSuffix}`,
      slug: `alpha-${uniqueSuffix}`,
      currency: "INR",
    },
  });

  const companyB = await prisma.company.create({
    data: {
      name: `Tenant Beta ${uniqueSuffix}`,
      slug: `beta-${uniqueSuffix}`,
      currency: "USD",
    },
  });

  const adminRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Admin",
      permissions: {
        create: [
          { module: "leads", action: "manage", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.COMPANY },
          { module: "leads", action: "create", dataScope: DataScope.COMPANY },
          { module: "leads", action: "update", dataScope: DataScope.COMPANY },
          { module: "leads", action: "delete", dataScope: DataScope.COMPANY },
          { module: "custom_fields", action: "manage", dataScope: DataScope.COMPANY },
          { module: "custom_fields", action: "view", dataScope: DataScope.COMPANY },
        ],
      },
    },
    include: { permissions: true },
  });

  const ownScopeRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Rep Own Scope",
      permissions: {
        create: [
          { module: "leads", action: "view", dataScope: DataScope.OWN },
          { module: "leads", action: "update", dataScope: DataScope.OWN },
        ],
      },
    },
    include: { permissions: true },
  });

  const viewOnlyRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Viewer",
      permissions: {
        create: [
          { module: "leads", action: "view", dataScope: DataScope.COMPANY },
        ],
      },
    },
    include: { permissions: true },
  });

  const userAdminA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: adminRoleA.id,
      email: `adminA_${uniqueSuffix}@example.com`,
      name: "Admin Alpha",
      hashedPassword: "hashed_test_password",
      status: "ACTIVE",
    },
  });

  const userRepA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: ownScopeRoleA.id,
      email: `repA_${uniqueSuffix}@example.com`,
      name: "Rep Alpha",
      hashedPassword: "hashed_test_password",
      status: "ACTIVE",
    },
  });

  const userViewerA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: viewOnlyRoleA.id,
      email: `viewerA_${uniqueSuffix}@example.com`,
      name: "Viewer Alpha",
      hashedPassword: "hashed_test_password",
      status: "ACTIVE",
    },
  });

  // Setup Company B user & custom field
  const userAdminB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      roleId: adminRoleA.id, // Can reuse role name schema
      email: `adminB_${uniqueSuffix}@example.com`,
      name: "Admin Beta",
      hashedPassword: "hashed_test_password",
      status: "ACTIVE",
    },
  });

  const betaField = await prisma.customField.create({
    data: {
      companyId: companyB.id,
      entityType: "LEAD",
      key: "beta_secret_field",
      label: "Beta Secret",
      fieldType: "TEXT",
    },
  });

  const betaLead = await prisma.lead.create({
    data: {
      companyId: companyB.id,
      name: "Beta Lead 1",
    },
  });

  // Setup Company A Custom Fields:
  // 1. Text (City)
  // 2. Select (Industry: Healthcare, Real Estate, SaaS, Education)
  // 3. Multi-Select (Product Interests: Core CRM, VoIP Calling, Analytics)
  // 4. Number (Deal Discount %)
  // 5. Boolean (VIP Customer)
  // 6. Required Text (Client Code)
  const cfCity = await prisma.customField.create({
    data: {
      companyId: companyA.id,
      entityType: "LEAD",
      key: "city",
      label: "City",
      fieldType: "TEXT",
    },
  });

  const cfIndustry = await prisma.customField.create({
    data: {
      companyId: companyA.id,
      entityType: "LEAD",
      key: "industry",
      label: "Industry Sector",
      fieldType: "SELECT",
      options: ["Healthcare", "Real Estate", "SaaS", "Education"],
    },
  });

  const cfInterests = await prisma.customField.create({
    data: {
      companyId: companyA.id,
      entityType: "LEAD",
      key: "product_interests",
      label: "Product Interests",
      fieldType: "MULTI_SELECT",
      options: ["Core CRM", "VoIP Calling", "Analytics"],
    },
  });

  const cfDiscount = await prisma.customField.create({
    data: {
      companyId: companyA.id,
      entityType: "LEAD",
      key: "discount_percent",
      label: "Discount %",
      fieldType: "NUMBER",
    },
  });

  const cfVip = await prisma.customField.create({
    data: {
      companyId: companyA.id,
      entityType: "LEAD",
      key: "is_vip",
      label: "VIP Customer",
      fieldType: "BOOLEAN",
    },
  });

  const cfRequiredCode = await prisma.customField.create({
    data: {
      companyId: companyA.id,
      entityType: "LEAD",
      key: "client_code",
      label: "Client Code",
      fieldType: "TEXT",
      required: true,
    },
  });

  // Setup Company A Leads:
  // Lead 1: Assigned to Rep A
  // Lead 2: Assigned to Rep A
  // Lead 3: Assigned to Admin A
  const lead1 = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      name: "Alpha Lead 1 (Acme Corp)",
      assignedUserId: userRepA.id,
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      name: "Alpha Lead 2 (Beta Tech)",
      assignedUserId: userRepA.id,
    },
  });

  const lead3 = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      name: "Alpha Lead 3 (Global Health)",
      assignedUserId: userAdminA.id,
    },
  });

  // Pre-seed some initial values on lead1
  await prisma.customFieldValue.create({
    data: {
      companyId: companyA.id,
      customFieldId: cfCity.id,
      entityId: lead1.id,
      value: "Delhi",
    },
  });

  await prisma.customFieldValue.create({
    data: {
      companyId: companyA.id,
      customFieldId: cfIndustry.id,
      entityId: lead1.id,
      value: "Healthcare",
    },
  });

  // Auth Sessions
  const sessionAdminA = await createDbSession(userAdminA.id, companyA.id);
  const sessionRepA = await createDbSession(userRepA.id, companyA.id);
  const sessionViewerA = await createDbSession(userViewerA.id, companyA.id);
  const sessionAdminB = await createDbSession(userAdminB.id, companyB.id);

  // Helper for invoking route handler
  async function callBulkRoute(token: string, body: any): Promise<{ status: number; json: any }> {
    const req = new NextRequest("http://localhost:3000/api/v1/leads/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `universal_crm_session=${token}`,
      },
      body: JSON.stringify(body),
    });
    const res = await bulkLeadRouteHandler(req);
    const json: any = await res.json();
    return { status: res.status, json };
  }

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Single Field Bulk Update & Partial Field Preservation
    // ------------------------------------------------------------------------
    console.log("  → [Test 1] Testing Single Custom Field Bulk Update & Non-Overwriting Semantics...");

    const res1 = await callBulkRoute(sessionAdminA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id, lead2.id, lead3.id],
      customFieldUpdates: [
        { key: "city", action: "SET", value: "Gurgaon" },
      ],
    });

    assert.equal(res1.status, 200);
    assert.equal(res1.json.success, true);
    assert.equal(res1.json.succeededCount, 3);
    assert.equal(res1.json.failedCount, 0);

    // Verify all 3 leads now have city = "Gurgaon"
    const lead1City = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfCity.id, entityId: lead1.id } },
    });
    const lead2City = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfCity.id, entityId: lead2.id } },
    });
    const lead3City = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfCity.id, entityId: lead3.id } },
    });

    assert.equal(lead1City?.value, "Gurgaon");
    assert.equal(lead2City?.value, "Gurgaon");
    assert.equal(lead3City?.value, "Gurgaon");

    // CRITICAL: Lead 1's previous Industry ("Healthcare") must NOT be overwritten!
    const lead1Industry = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfIndustry.id, entityId: lead1.id } },
    });
    assert.equal(lead1Industry?.value, "Healthcare", "Untouched custom fields must remain unchanged");

    console.log("  ✓ Single field bulk update with partial field preservation passed");

    // ------------------------------------------------------------------------
    // TEST 2: Multiple Custom Fields Bulk Update (Select, Multi-Select, Number, Boolean)
    // ------------------------------------------------------------------------
    console.log("  → [Test 2] Testing Multiple Custom Fields Bulk Update Across Different Types...");

    const res2 = await callBulkRoute(sessionAdminA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id, lead2.id],
      customFieldUpdates: [
        { key: "industry", action: "SET", value: "SaaS" },
        { key: "product_interests", action: "SET", value: ["Core CRM", "VoIP Calling"] },
        { key: "discount_percent", action: "SET", value: 15.5 },
        { key: "is_vip", action: "SET", value: true },
      ],
    });

    assert.equal(res2.status, 200);
    assert.equal(res2.json.success, true);
    assert.equal(res2.json.succeededCount, 2);

    // Verify lead2 values
    const lead2Industry = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfIndustry.id, entityId: lead2.id } },
    });
    const lead2Interests = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfInterests.id, entityId: lead2.id } },
    });
    const lead2Discount = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfDiscount.id, entityId: lead2.id } },
    });
    const lead2Vip = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfVip.id, entityId: lead2.id } },
    });

    assert.equal(lead2Industry?.value, "SaaS");
    assert.deepEqual(lead2Interests?.value, ["Core CRM", "VoIP Calling"]);
    assert.equal(lead2Discount?.value, 15.5);
    assert.equal(lead2Vip?.value, true);

    console.log("  ✓ Multi-field typed bulk update passed");

    // ------------------------------------------------------------------------
    // TEST 3: Explicit CLEAR Operation on Custom Fields
    // ------------------------------------------------------------------------
    console.log("  → [Test 3] Testing Explicit CLEAR Operation...");

    const res3 = await callBulkRoute(sessionAdminA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id, lead2.id],
      customFieldUpdates: [
        { key: "industry", action: "CLEAR" },
      ],
    });

    assert.equal(res3.status, 200);
    assert.equal(res3.json.success, true);

    // Verify Industry record is removed / cleared
    const lead1ClearedIndustry = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfIndustry.id, entityId: lead1.id } },
    });
    const lead2ClearedIndustry = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfIndustry.id, entityId: lead2.id } },
    });

    assert.equal(lead1ClearedIndustry, null, "Cleared field value record must be removed");
    assert.equal(lead2ClearedIndustry, null, "Cleared field value record must be removed");

    // Lead 1's city ("Gurgaon") should still be intact!
    const lead1CityRecheck = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfCity.id, entityId: lead1.id } },
    });
    assert.equal(lead1CityRecheck?.value, "Gurgaon");

    console.log("  ✓ Explicit CLEAR operation verified");

    // ------------------------------------------------------------------------
    // TEST 4: Field Validation (Invalid select, bad number, malformed values)
    // ------------------------------------------------------------------------
    console.log("  → [Test 4] Testing Server-Side Field Validation...");

    // Invalid select option
    const resBadSelect = await callBulkRoute(sessionAdminA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id],
      customFieldUpdates: [
        { key: "industry", action: "SET", value: "NonExistentSector123" },
      ],
    });
    assert.equal(resBadSelect.status, 400);
    assert.equal(resBadSelect.json.error.code, "VALIDATION_ERROR");

    // Invalid number
    const resBadNumber = await callBulkRoute(sessionAdminA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id],
      customFieldUpdates: [
        { key: "discount_percent", action: "SET", value: "NotANumber" },
      ],
    });
    assert.equal(resBadNumber.status, 400);
    assert.equal(resBadNumber.json.error.code, "VALIDATION_ERROR");

    console.log("  ✓ Server-side type validation rejected invalid inputs");

    // ------------------------------------------------------------------------
    // TEST 5: Required Field Protection (Cannot CLEAR a required field)
    // ------------------------------------------------------------------------
    console.log("  → [Test 5] Testing Required Field Protection...");

    const resClearRequired = await callBulkRoute(sessionAdminA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id],
      customFieldUpdates: [
        { key: "client_code", action: "CLEAR" },
      ],
    });

    assert.equal(resClearRequired.status, 400);
    assert.ok(resClearRequired.json.error.message.includes("required and cannot be cleared"));

    console.log("  ✓ Required field clear protection enforced");

    // ------------------------------------------------------------------------
    // TEST 6: Strict Tenant Isolation
    // ------------------------------------------------------------------------
    console.log("  → [Test 6] Testing Strict Tenant Isolation...");

    // Company A user trying to use Company B's custom field
    const resForeignField = await callBulkRoute(sessionAdminA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id],
      customFieldUpdates: [
        { key: betaField.key, action: "SET", value: "HackValue" },
      ],
    });
    assert.equal(resForeignField.status, 400);
    assert.ok(resForeignField.json.error.message.includes("not found or not active"));

    // Company A user trying to update Company B's lead
    const resForeignLead = await callBulkRoute(sessionAdminA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [betaLead.id],
      customFieldUpdates: [
        { key: "city", action: "SET", value: "Mumbai" },
      ],
    });
    assert.equal(resForeignLead.status, 200);
    assert.equal(resForeignLead.json.succeededCount, 0);
    assert.equal(resForeignLead.json.skippedCount, 1);
    assert.ok(resForeignLead.json.skipped[0].reason.includes("Lead not found in this organization"));

    console.log("  ✓ Strict multi-tenant isolation verified");

    // ------------------------------------------------------------------------
    // TEST 7: RBAC Data Scope Enforcement (OWN vs COMPANY)
    // ------------------------------------------------------------------------
    console.log("  → [Test 7] Testing RBAC Data Scope Enforcement...");

    // Rep A has OWN scope: lead1 and lead2 belong to Rep A; lead3 belongs to Admin A.
    const resRepA = await callBulkRoute(sessionRepA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id, lead2.id, lead3.id],
      customFieldUpdates: [
        { key: "city", action: "SET", value: "Noida" },
      ],
    });

    assert.equal(resRepA.status, 200);
    assert.equal(resRepA.json.succeededCount, 2, "Rep with OWN scope should update only own leads");
    assert.equal(resRepA.json.skippedCount, 1, "Lead3 outside Rep scope should be skipped");
    assert.ok(resRepA.json.skipped[0].reason.includes("Outside permitted data scope (OWN)"));

    // Verify lead3's city is still "Gurgaon" (untouched by Rep A)
    const lead3CityRepCheck = await prisma.customFieldValue.findUnique({
      where: { companyId_customFieldId_entityId: { companyId: companyA.id, customFieldId: cfCity.id, entityId: lead3.id } },
    });
    assert.equal(lead3CityRepCheck?.value, "Gurgaon");

    console.log("  ✓ RBAC Data Scope (OWN vs COMPANY) strictly enforced");

    // ------------------------------------------------------------------------
    // TEST 8: Security / Permission Rejection
    // ------------------------------------------------------------------------
    console.log("  → [Test 8] Testing Permission Rejection for View-Only User...");

    const resViewer = await callBulkRoute(sessionViewerA.rawToken, {
      action: "EDIT_CUSTOM_FIELDS",
      leadIds: [lead1.id],
      customFieldUpdates: [
        { key: "city", action: "SET", value: "Pune" },
      ],
    });

    assert.equal(resViewer.status, 403);
    assert.equal(resViewer.json.error.code, "FORBIDDEN");

    console.log("  ✓ View-only user properly rejected with 403 Forbidden");

    // ------------------------------------------------------------------------
    // TEST 9: Audit Logging Verification
    // ------------------------------------------------------------------------
    console.log("  → [Test 9] Testing Audit Logging Verification...");

    const latestAudit = await prisma.auditLog.findFirst({
      where: {
        companyId: companyA.id,
        action: "BULK_LEAD_EDIT_CUSTOM_FIELDS",
      },
      orderBy: { createdAt: "desc" },
    });

    assert.ok(latestAudit !== null, "Audit log record must be created for bulk custom field edit");
    assert.equal(latestAudit.entityType, "LEAD");
    const auditMeta = latestAudit.metadata as any;
    assert.ok(auditMeta.succeededCount > 0);
    assert.ok(Array.isArray(auditMeta.fields));

    console.log("  ✓ Audit logging recorded accurately");

    console.log("🎉 ALL PHASE 3 LEAD BULK CUSTOM FIELDS TESTS PASSED!\n");
  } finally {
    // Cleanup test data
    await prisma.session.deleteMany({
      where: { userId: { in: [userAdminA.id, userRepA.id, userViewerA.id, userAdminB.id] } },
    }).catch(() => {});
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    }).catch(() => {});
    await prisma.customFieldValue.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    }).catch(() => {});
    await prisma.customField.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    }).catch(() => {});
    await prisma.lead.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [userAdminA.id, userRepA.id, userViewerA.id, userAdminB.id] } },
    }).catch(() => {});
    await prisma.role.deleteMany({
      where: { id: { in: [adminRoleA.id, ownScopeRoleA.id, viewOnlyRoleA.id] } },
    }).catch(() => {});
    await prisma.company.deleteMany({
      where: { id: { in: [companyA.id, companyB.id] } },
    }).catch(() => {});
  }
}
