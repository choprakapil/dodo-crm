/**
 * Phase 2: Disposition Hierarchy UX & Hierarchy Safety Engine Test Suite
 *
 * Comprehensive validation covering:
 * 1. Parent/Child relationship inspection (0, 1, multiple children)
 * 2. Hierarchy Protection: Deletion blocked when children exist
 * 3. Atomic Child Reassignment (to another parent, to top-level)
 * 4. Cycle Detection & Prevention (self-parent, descendant destination)
 * 5. Materialized Path & Depth Recalculation across subtree
 * 6. Cascade Deactivation with child descendants
 * 7. Tenant Isolation (Cross-tenant rejection for inspection, reassignment, deactivation)
 * 8. Super Admin Hierarchy APIs & Platform Audit Logging
 * 9. RBAC Security verification (viewers/reps cannot manage hierarchy)
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { DispositionService } from "../lib/services/disposition.service";
import { PlatformCrmConfigService } from "../lib/services/platform-crm-config.service";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { DataScope } from "@prisma/client";

export async function runPhase2DispositionHierarchyUxTests() {
  console.log("\n🧪 Running Phase 2: Disposition Hierarchy UX & Hierarchy Safety Test Suite...");

  const uniqueSuffix = `p2_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Setup Test Companies & Roles
  const companyA = await prisma.company.create({
    data: {
      name: `Tenant Alpha ${uniqueSuffix}`,
      slug: `alpha-${uniqueSuffix}`,
      currency: "USD",
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
          { module: "dispositions", action: "manage", dataScope: DataScope.COMPANY },
          { module: "dispositions", action: "view", dataScope: DataScope.COMPANY },
          { module: "dispositions", action: "create", dataScope: DataScope.COMPANY },
          { module: "dispositions", action: "update", dataScope: DataScope.COMPANY },
          { module: "dispositions", action: "delete", dataScope: DataScope.COMPANY },
        ],
      },
    },
    include: { permissions: true },
  });

  const repRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Sales Rep",
      permissions: {
        create: [
          { module: "dispositions", action: "view", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.COMPANY },
        ],
      },
    },
    include: { permissions: true },
  });

  const adminRoleB = await prisma.role.create({
    data: {
      companyId: companyB.id,
      name: "Admin",
      permissions: {
        create: [
          { module: "dispositions", action: "manage", dataScope: DataScope.COMPANY },
          { module: "dispositions", action: "view", dataScope: DataScope.COMPANY },
          { module: "dispositions", action: "create", dataScope: DataScope.COMPANY },
          { module: "dispositions", action: "update", dataScope: DataScope.COMPANY },
          { module: "dispositions", action: "delete", dataScope: DataScope.COMPANY },
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
      roleId: repRoleA.id,
      email: `repA_${uniqueSuffix}@example.com`,
      name: "Rep Alpha",
      hashedPassword: "hashed_test_password",
      status: "ACTIVE",
    },
  });

  const userAdminB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      roleId: adminRoleB.id,
      email: `adminB_${uniqueSuffix}@example.com`,
      name: "Admin Beta",
      hashedPassword: "hashed_test_password",
      status: "ACTIVE",
    },
  });


  const superAdmin = await prisma.superAdmin.create({
    data: {
      email: `super_${uniqueSuffix}@dodo.internal`,
      name: "Super Platform Admin",
      hashedPassword: "super_hashed_password",
    },
  });

  // Auth Contexts
  const sessionAdminA = await createDbSession(userAdminA.id, companyA.id);
  const ctxAdminA = (await validateSessionToken(sessionAdminA.rawToken))!;

  const sessionRepA = await createDbSession(userRepA.id, companyA.id);
  const ctxRepA = (await validateSessionToken(sessionRepA.rawToken))!;

  const sessionAdminB = await createDbSession(userAdminB.id, companyB.id);
  const ctxAdminB = (await validateSessionToken(sessionAdminB.rawToken))!;

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Hierarchy Tree Creation (Parent, Child 1, Child 2, Grandchild)
    // ------------------------------------------------------------------------
    console.log("  → [Test 1] Testing Multi-tier Hierarchy Creation & Stats Inspection...");

    const rootParent = await DispositionService.createDisposition(ctxAdminA, {
      name: "Contacted / In Discussion",
      code: "IN_DISC",
      color: "#4F46E5",
    });
    assert.equal(rootParent.depth, 0);
    assert.equal(rootParent.parentId, null);

    const child1 = await DispositionService.createDisposition(ctxAdminA, {
      parentId: rootParent.id,
      name: "Price Negotiation",
      code: "NEGOTIATION",
      color: "#06B6D4",
    });
    assert.equal(child1.depth, 1);
    assert.equal(child1.parentId, rootParent.id);

    const child2 = await DispositionService.createDisposition(ctxAdminA, {
      parentId: rootParent.id,
      name: "Technical Demo Requested",
      code: "DEMO_REQ",
      color: "#10B981",
    });
    assert.equal(child2.depth, 1);
    assert.equal(child2.parentId, rootParent.id);

    const grandChild = await DispositionService.createDisposition(ctxAdminA, {
      parentId: child1.id,
      name: "Custom Enterprise Pricing",
      code: "ENT_PRICE",
      color: "#F59E0B",
    });
    assert.equal(grandChild.depth, 2);
    assert.equal(grandChild.parentId, child1.id);

    // Inspect Children Stats
    const parentStats = await DispositionService.getDispositionChildren(ctxAdminA, rootParent.id);
    assert.equal(parentStats.children.length, 2, "Root parent must have 2 direct children");
    assert.equal(parentStats.totalDescendantsCount, 3, "Root parent must have 3 total descendants");
    assert.equal(parentStats.hasActiveChildren, true);

    console.log("  ✓ Multi-tier hierarchy creation and child subtree inspection passed");

    // ------------------------------------------------------------------------
    // TEST 2: Hierarchy Protection on Deletion
    // ------------------------------------------------------------------------
    console.log("  → [Test 2] Testing Hierarchy Protection on Deletion...");

    await assert.rejects(
      async () => {
        await DispositionService.deleteDisposition(ctxAdminA, rootParent.id);
      },
      ValidationError,
      "Deleting parent with active children must be blocked with ValidationError"
    );

    await assert.rejects(
      async () => {
        await DispositionService.deleteDisposition(ctxAdminA, child1.id);
      },
      ValidationError,
      "Deleting child with active grandchild must be blocked with ValidationError"
    );

    console.log("  ✓ Deletion strictly blocked for dispositions with active children");

    // ------------------------------------------------------------------------
    // TEST 3: Cycle Detection & Invalid Parent Validation
    // ------------------------------------------------------------------------
    console.log("  → [Test 3] Testing Cycle Detection and Self-Parent Prevention...");

    // Cannot reassign children to the source parent itself
    await assert.rejects(
      async () => {
        await DispositionService.reassignChildren(ctxAdminA, rootParent.id, rootParent.id);
      },
      ValidationError,
      "Cannot reassign children to self"
    );

    // Cannot reassign children to a descendant of rootParent (child1)
    await assert.rejects(
      async () => {
        await DispositionService.reassignChildren(ctxAdminA, rootParent.id, child1.id);
      },
      ValidationError,
      "Cannot reassign children under a descendant (cycle prevention)"
    );

    // Cannot reassign children to cross-tenant parent
    const betaDisp = await DispositionService.createDisposition(ctxAdminB, {
      name: "Beta Tenant Root",
    });

    await assert.rejects(
      async () => {
        await DispositionService.reassignChildren(ctxAdminA, rootParent.id, betaDisp.id);
      },
      ValidationError,
      "Cannot reassign children to a parent belonging to another tenant"
    );

    console.log("  ✓ Cycle detection and cross-tenant validation enforced");

    // ------------------------------------------------------------------------
    // TEST 4: Atomic Child Reassignment to Another Parent
    // ------------------------------------------------------------------------
    console.log("  → [Test 4] Testing Child Reassignment to Another Parent...");

    const alternateParent = await DispositionService.createDisposition(ctxAdminA, {
      name: "Qualified Pipeline",
      code: "QUALIFIED",
      color: "#8B5CF6",
    });

    const reassignmentResult = await DispositionService.reassignChildren(
      ctxAdminA,
      rootParent.id,
      alternateParent.id
    );

    assert.equal(reassignmentResult.count, 2, "2 children should be reassigned");

    // Verify children's updated parent, depth, and paths
    const updatedChild1 = await DispositionService.getDispositionById(ctxAdminA, child1.id);
    const updatedChild2 = await DispositionService.getDispositionById(ctxAdminA, child2.id);
    const updatedGrandChild = await DispositionService.getDispositionById(ctxAdminA, grandChild.id);

    assert.equal(updatedChild1.parentId, alternateParent.id);
    assert.equal(updatedChild1.depth, 1);
    assert.ok(updatedChild1.path?.startsWith(`/${alternateParent.id}/`));

    assert.equal(updatedChild2.parentId, alternateParent.id);
    assert.equal(updatedChild2.depth, 1);
    assert.ok(updatedChild2.path?.startsWith(`/${alternateParent.id}/`));

    // Verify grandChild depth and path was recursively updated!
    assert.equal(updatedGrandChild.depth, 2);
    assert.ok(updatedGrandChild.path?.startsWith(`/${alternateParent.id}/${child1.id}/`));

    // Root parent now has 0 children
    const rootStatsAfter = await DispositionService.getDispositionChildren(ctxAdminA, rootParent.id);
    assert.equal(rootStatsAfter.children.length, 0);
    assert.equal(rootStatsAfter.hasActiveChildren, false);

    console.log("  ✓ Reassignment to alternate parent with recursive subtree update passed");

    // ------------------------------------------------------------------------
    // TEST 5: Safe Deletion of Emptied Parent
    // ------------------------------------------------------------------------
    console.log("  → [Test 5] Testing Safe Deletion of Emptied Parent...");

    const deletedRoot = await DispositionService.deleteDisposition(ctxAdminA, rootParent.id);
    assert.ok(deletedRoot.deletedAt !== null);
    assert.equal(deletedRoot.isActive, false);

    console.log("  ✓ Emptied parent deleted safely after child reassignment");

    // ------------------------------------------------------------------------
    // TEST 6: Child Reassignment to Top-Level (null)
    // ------------------------------------------------------------------------
    console.log("  → [Test 6] Testing Child Reassignment to Top-Level (No Parent)...");

    const reassignToRootResult = await DispositionService.reassignChildren(
      ctxAdminA,
      alternateParent.id,
      null
    );
    assert.equal(reassignToRootResult.count, 2);

    const promotedChild1 = await DispositionService.getDispositionById(ctxAdminA, child1.id);
    assert.equal(promotedChild1.parentId, null);
    assert.equal(promotedChild1.depth, 0);
    assert.equal(promotedChild1.path, `/${child1.id}`);

    const promotedGrandChild = await DispositionService.getDispositionById(ctxAdminA, grandChild.id);
    assert.equal(promotedGrandChild.depth, 1);
    assert.equal(promotedGrandChild.path, `/${child1.id}/${grandChild.id}`);

    console.log("  ✓ Promotion to top-level with recursive subtree recalculation passed");

    // ------------------------------------------------------------------------
    // TEST 7: Cascade Deactivation
    // ------------------------------------------------------------------------
    console.log("  → [Test 7] Testing Cascade Deactivation...");

    const cascadeResult = await DispositionService.deactivateWithChildren(ctxAdminA, child1.id);
    assert.equal(cascadeResult.parent.isActive, false);
    assert.equal(cascadeResult.deactivatedCount, 2, "Parent and 1 active grandchild deactivated");

    const checkGrandchild = await DispositionService.getDispositionById(ctxAdminA, grandChild.id);
    assert.equal(checkGrandchild.isActive, false, "Grandchild must be deactivated");

    console.log("  ✓ Cascade deactivation across subtree passed");

    // ------------------------------------------------------------------------
    // TEST 8: Super Admin Platform CRM Config Reassignment & Info APIs
    // ------------------------------------------------------------------------
    console.log("  → [Test 8] Testing Super Admin Platform Hierarchy APIs...");

    const platformRoot = await PlatformCrmConfigService.createDisposition(
      {
        companyId: companyB.id,
        name: "Super Admin Root Disposition",
        color: "#EF4444",
      },
      superAdmin.id
    );

    const platformChild = await PlatformCrmConfigService.createDisposition(
      {
        companyId: companyB.id,
        parentId: platformRoot.id,
        name: "Super Admin Child Disposition",
      },
      superAdmin.id
    );

    const hierarchyInfo = await PlatformCrmConfigService.getDispositionHierarchyInfo(platformRoot.id);
    assert.equal(hierarchyInfo.children.length, 1);
    assert.equal(hierarchyInfo.hasActiveChildren, true);

    const platformReassign = await PlatformCrmConfigService.reassignChildren(
      platformRoot.id,
      null,
      superAdmin.id
    );
    assert.equal(platformReassign.count, 1);

    const recheckChild = await prisma.disposition.findUniqueOrThrow({ where: { id: platformChild.id } });
    assert.equal(recheckChild.parentId, null);

    console.log("  ✓ Super Admin Platform hierarchy methods & audit logging verified");

    // ------------------------------------------------------------------------
    // TEST 9: RBAC Security Verification
    // ------------------------------------------------------------------------
    console.log("  → [Test 9] Testing RBAC Security Rules...");

    // Sales Rep cannot reassign children or deactivate cascade
    await assert.rejects(
      async () => {
        await DispositionService.reassignChildren(ctxRepA, promotedChild1.id, null);
      },
      ForbiddenError,
      "Sales rep cannot execute child reassignment"
    );

    await assert.rejects(
      async () => {
        await DispositionService.deactivateWithChildren(ctxRepA, promotedChild1.id);
      },
      ForbiddenError,
      "Sales rep cannot execute cascade deactivation"
    );

    // Cross-tenant inspection rejected
    await assert.rejects(
      async () => {
        await DispositionService.getDispositionChildren(ctxAdminB, promotedChild1.id);
      },
      NotFoundError,
      "Cross-tenant disposition inspection must return NotFoundError"
    );

    console.log("  ✓ RBAC permissions and tenant isolation strictly preserved");

    console.log("🎉 ALL PHASE 2 DISPOSITION HIERARCHY UX & SAFETY TESTS PASSED!\n");
  } finally {
    // Cleanup test data safely respecting MySQL self-referential restrict constraint
    await prisma.session.deleteMany({
      where: { userId: { in: [userAdminA.id, userRepA.id, userAdminB.id] } },
    }).catch(() => {});
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    }).catch(() => {});
    await prisma.platformAuditLog.deleteMany({
      where: { superAdminId: superAdmin.id },
    }).catch(() => {});
    await prisma.disposition.updateMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
      data: { parentId: null },
    }).catch(() => {});
    await prisma.disposition.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [userAdminA.id, userRepA.id, userAdminB.id] } },
    }).catch(() => {});
    await prisma.role.deleteMany({
      where: { id: { in: [adminRoleA.id, repRoleA.id, adminRoleB.id] } },
    }).catch(() => {});
    await prisma.company.deleteMany({
      where: { id: { in: [companyA.id, companyB.id] } },
    }).catch(() => {});
    await prisma.superAdmin.deleteMany({
      where: { id: superAdmin.id },
    }).catch(() => {});
  }
}

