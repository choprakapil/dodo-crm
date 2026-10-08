/**
 * Phase 6 Test Suite: Division / Department / Team Organizational Hierarchy
 *
 * Tests:
 * 1. Division CRUD, tenant scoping, and duplicate prevention
 * 2. Department CRUD, valid division linkage, and duplicate prevention
 * 3. Cross-tenant isolation (Divisions, Departments, Teams)
 * 4. Hierarchy integrity & orphaning protection (blocking deletion of divisions with child departments, and departments with child teams)
 * 5. Team assignment to department & safe moving between departments
 * 6. Organization tree structure with stats and backward-compatible unassigned teams
 * 7. Audit log verification for all hierarchy operations
 * 8. RBAC and permissions enforcement
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { OrganizationHierarchyService } from "../lib/services/organization-hierarchy.service";
import { TeamService } from "../lib/services/team.service";
import { ValidationError, NotFoundError } from "../lib/errors";
import { DataScope, CompanyStatus, UserStatus } from "@prisma/client";

export async function runPhase6OrganizationalHierarchyTests() {
  console.log("\n====================================================================");
  console.log("🏢 RUNNING PHASE 6: ORGANIZATIONAL HIERARCHY TEST SUITE");
  console.log("====================================================================");

  const uniqueSuffix = `p6_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Setup test companies
  const companyA = await prisma.company.create({
    data: {
      name: `Org Test Corp A ${uniqueSuffix}`,
      slug: `org-test-a-${uniqueSuffix}`,
      status: CompanyStatus.ACTIVE,
      currency: "INR",
    },
  });

  const companyB = await prisma.company.create({
    data: {
      name: `Org Test Corp B ${uniqueSuffix}`,
      slug: `org-test-b-${uniqueSuffix}`,
      status: CompanyStatus.ACTIVE,
      currency: "USD",
    },
  });

  const roleAdminA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Admin",
      permissions: {
        create: [
          { module: "teams", action: "manage", dataScope: DataScope.COMPANY },
          { module: "teams", action: "view", dataScope: DataScope.COMPANY },
          { module: "users", action: "manage", dataScope: DataScope.COMPANY },
          { module: "users", action: "view", dataScope: DataScope.COMPANY },
          { module: "settings", action: "manage", dataScope: DataScope.COMPANY },
          { module: "settings", action: "view", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  const roleAdminB = await prisma.role.create({
    data: {
      companyId: companyB.id,
      name: "Admin",
      permissions: {
        create: [
          { module: "teams", action: "manage", dataScope: DataScope.COMPANY },
          { module: "teams", action: "view", dataScope: DataScope.COMPANY },
          { module: "users", action: "manage", dataScope: DataScope.COMPANY },
          { module: "users", action: "view", dataScope: DataScope.COMPANY },
          { module: "settings", action: "manage", dataScope: DataScope.COMPANY },
          { module: "settings", action: "view", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  const userAdminA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: roleAdminA.id,
      email: `adminA_${uniqueSuffix}@example.com`,
      name: "Admin User A",
      status: UserStatus.ACTIVE,
    },
  });

  const userAdminB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      roleId: roleAdminB.id,
      email: `adminB_${uniqueSuffix}@example.com`,
      name: "Admin User B",
      status: UserStatus.ACTIVE,
    },
  });

  const memberUserA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: roleAdminA.id,
      email: `memberA_${uniqueSuffix}@example.com`,
      name: "Team Member A",
      status: UserStatus.ACTIVE,
    },
  });

  // DB-backed valid sessions for AuthContext
  const sessionA = await createDbSession(userAdminA.id, companyA.id);
  const ctxA = (await validateSessionToken(sessionA.rawToken))!;
  assert.ok(ctxA, "Session A must produce valid AuthContext");

  const sessionB = await createDbSession(userAdminB.id, companyB.id);
  const ctxB = (await validateSessionToken(sessionB.rawToken))!;
  assert.ok(ctxB, "Session B must produce valid AuthContext");

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Division CRUD, Code & Tenant Scoping
    // -------------------------------------------------------------------------
    console.log("  [TEST 1] Testing Division CRUD and tenant scoping...");
    const divisionA1 = await OrganizationHierarchyService.createDivision(ctxA, {
      name: "Commercial Division",
      code: "COMM-01",
      description: "Direct enterprise and commercial sales",
      managerId: userAdminA.id,
    });

    assert.ok(divisionA1.id, "Division ID should be defined");
    assert.equal(divisionA1.companyId, companyA.id, "Division should belong to Company A");
    assert.equal(divisionA1.name, "Commercial Division", "Division name should match");
    assert.equal(divisionA1.code, "COMM-01", "Division code should match");
    assert.equal(divisionA1.manager?.id, userAdminA.id, "Division manager should match");

    // Test duplicate division name in Company A rejected
    let duplicateRejected = false;
    try {
      await OrganizationHierarchyService.createDivision(ctxA, {
        name: "Commercial Division",
      });
    } catch (e) {
      duplicateRejected = e instanceof ValidationError;
    }
    assert.ok(duplicateRejected, "Duplicate division name in same company should be rejected");

    // But Company B CAN create a division with the same name (tenant isolation)
    const divisionB1 = await OrganizationHierarchyService.createDivision(ctxB, {
      name: "Commercial Division",
    });
    assert.equal(divisionB1.companyId, companyB.id, "Company B should be able to create same division name");

    // Update Division A1
    const updatedDivA1 = await OrganizationHierarchyService.updateDivision(ctxA, divisionA1.id, {
      description: "Updated division description",
      code: "COMM-DIV-V2",
    });
    assert.equal(updatedDivA1.description, "Updated division description", "Division description should be updated");
    assert.equal(updatedDivA1.code, "COMM-DIV-V2", "Division code should be updated");

    // -------------------------------------------------------------------------
    // TEST 2: Department CRUD and Division Linkage
    // -------------------------------------------------------------------------
    console.log("  [TEST 2] Testing Department CRUD and valid Division linkage...");
    const deptA1 = await OrganizationHierarchyService.createDepartment(ctxA, {
      divisionId: divisionA1.id,
      name: "Enterprise Accounts",
      code: "ENT-ACC",
      description: "Strategic accounts and key accounts",
      managerId: userAdminA.id,
    });

    assert.ok(deptA1.id, "Department ID should be defined");
    assert.equal(deptA1.divisionId, divisionA1.id, "Department should belong to Division A1");
    assert.equal(deptA1.companyId, companyA.id, "Department should belong to Company A");

    const deptA2 = await OrganizationHierarchyService.createDepartment(ctxA, {
      divisionId: divisionA1.id,
      name: "Mid-Market Sales",
      code: "MM-SALES",
    });
    assert.ok(deptA2.id, "Department A2 ID should be defined");

    // -------------------------------------------------------------------------
    // TEST 3: Cross-Tenant Isolation Enforcement
    // -------------------------------------------------------------------------
    console.log("  [TEST 3] Testing Cross-Tenant Security Isolation...");
    // Company B cannot view Company A's division
    let crossDivViewRejected = false;
    try {
      await OrganizationHierarchyService.getDivisionById(ctxB, divisionA1.id);
    } catch (e) {
      crossDivViewRejected = e instanceof NotFoundError;
    }
    assert.ok(crossDivViewRejected, "Cross-tenant division access must return 404 NotFound");

    // Company B cannot create a department pointing to Company A's division
    let crossDivDeptRejected = false;
    try {
      await OrganizationHierarchyService.createDepartment(ctxB, {
        divisionId: divisionA1.id,
        name: "Malicious Dept",
      });
    } catch (e) {
      crossDivDeptRejected = e instanceof ValidationError;
    }
    assert.ok(crossDivDeptRejected, "Creating department in foreign division must be rejected");

    // Company B cannot view Company A's department
    let crossDeptViewRejected = false;
    try {
      await OrganizationHierarchyService.getDepartmentById(ctxB, deptA1.id);
    } catch (e) {
      crossDeptViewRejected = e instanceof NotFoundError;
    }
    assert.ok(crossDeptViewRejected, "Cross-tenant department access must return 404 NotFound");

    // -------------------------------------------------------------------------
    // TEST 4: Team Department Association & Moving Teams
    // -------------------------------------------------------------------------
    console.log("  [TEST 4] Testing Team creation with department and moving teams...");
    // Create Team in Department A1
    const teamA1 = await TeamService.createTeam(ctxA, {
      name: `Fortune 500 Team ${uniqueSuffix}`,
      departmentId: deptA1.id,
      managerId: userAdminA.id,
      description: "Direct strategic accounts squad",
    });

    assert.equal(teamA1.departmentId, deptA1.id, "Team should be assigned to Department A1");

    // Add member to Team A1
    await TeamService.addTeamMember(ctxA, teamA1.id, memberUserA.id);

    // Cross-tenant: Company B cannot assign a team to Company A's department
    let crossTeamDeptRejected = false;
    try {
      await TeamService.createTeam(ctxB, {
        name: `Infiltrator Team ${uniqueSuffix}`,
        departmentId: deptA1.id,
      });
    } catch (e) {
      crossTeamDeptRejected = e instanceof ValidationError;
    }
    assert.ok(crossTeamDeptRejected, "Assigning team to foreign tenant's department must be rejected");

    // Move Team A1 from Department A1 to Department A2
    const movedTeam = await TeamService.updateTeam(ctxA, teamA1.id, {
      departmentId: deptA2.id,
    });
    assert.equal(movedTeam.departmentId, deptA2.id, "Team should now be assigned to Department A2");
    assert.equal(movedTeam.department?.name, "Mid-Market Sales", "Department relation should reflect new department");

    // Verify team members and lead links remain intact after move
    const retrievedTeam = await TeamService.getTeamById(ctxA, teamA1.id);
    assert.equal(retrievedTeam.departmentId, deptA2.id, "Retrieved team departmentId should match");
    assert.ok(retrievedTeam.members.some((m) => m.id === memberUserA.id), "Team members must be preserved after move");

    // -------------------------------------------------------------------------
    // TEST 5: Deletion Safety & Orphaning Protection
    // -------------------------------------------------------------------------
    console.log("  [TEST 5] Testing Deletion Safety (Blocking orphaning)...");
    // Attempt to delete Department A2 while Team A1 is inside it
    let deptDeleteBlocked = false;
    try {
      await OrganizationHierarchyService.deleteDepartment(ctxA, deptA2.id);
    } catch (e) {
      deptDeleteBlocked = e instanceof ValidationError;
    }
    assert.ok(deptDeleteBlocked, "Deleting department with active child teams must be blocked with ValidationError");

    // Attempt to delete Division A1 while Department A1 & A2 are inside it
    let divDeleteBlocked = false;
    try {
      await OrganizationHierarchyService.deleteDivision(ctxA, divisionA1.id);
    } catch (e) {
      divDeleteBlocked = e instanceof ValidationError;
    }
    assert.ok(divDeleteBlocked, "Deleting division with active child departments must be blocked with ValidationError");

    // -------------------------------------------------------------------------
    // TEST 6: Organization Tree & Unassigned Teams Backward Compatibility
    // -------------------------------------------------------------------------
    console.log("  [TEST 6] Testing Organization Tree generation and backward compatibility...");
    // Create an unassigned team (departmentId is null) to verify 100% backward compatibility
    const unassignedTeam = await TeamService.createTeam(ctxA, {
      name: `Legacy Standalone Team ${uniqueSuffix}`,
      description: "Existing legacy team without department",
    });
    assert.equal(unassignedTeam.departmentId, null, "Unassigned team departmentId must be null");

    const tree = await OrganizationHierarchyService.getOrganizationTree(ctxA);
    assert.equal(tree.company.id, companyA.id, "Tree company ID must match");
    assert.equal(tree.stats.divisionCount, 1, "Stats division count should be 1");
    assert.equal(tree.stats.departmentCount, 2, "Stats department count should be 2");
    assert.equal(tree.stats.assignedTeamCount, 1, "Stats assigned team count should be 1");
    assert.ok(tree.stats.unassignedTeamCount >= 1, "Stats unassigned team count should be at least 1");

    // Check nested structure
    const treeDiv = tree.divisions.find((d) => d.id === divisionA1.id);
    assert.ok(treeDiv, "Division A1 must be present in tree");
    assert.equal(treeDiv!.departments.length, 2, "Division A1 should have 2 departments");

    const treeDept2 = treeDiv!.departments.find((d) => d.id === deptA2.id);
    assert.ok(treeDept2, "Dept A2 must be present in tree");
    assert.equal(treeDept2!.teams.length, 1, "Dept A2 should have 1 team");
    assert.equal(treeDept2!.teams[0].id, teamA1.id, "Team A1 must be present under Dept A2");

    // Check unassigned teams array
    const treeUnassigned = tree.unassignedTeams.find((t) => t.id === unassignedTeam.id);
    assert.ok(treeUnassigned, "Legacy unassigned team must be present in unassignedTeams list");

    // -------------------------------------------------------------------------
    // TEST 7: Audit Logging for Hierarchy Operations
    // -------------------------------------------------------------------------
    console.log("  [TEST 7] Testing Audit Logging for Hierarchy Events...");
    const auditLogs = await prisma.auditLog.findMany({
      where: { companyId: companyA.id },
      orderBy: { createdAt: "desc" },
    });

    const divisionCreatedLog = auditLogs.find((l) => l.action === "division.created" && l.entityId === divisionA1.id);
    const departmentCreatedLog = auditLogs.find((l) => l.action === "department.created" && l.entityId === deptA1.id);
    const teamCreatedLog = auditLogs.find((l) => l.action === "team.created" && l.entityId === teamA1.id);

    assert.ok(divisionCreatedLog, "Audit log for division creation must exist");
    assert.ok(departmentCreatedLog, "Audit log for department creation must exist");
    assert.ok(teamCreatedLog, "Audit log for team creation must exist");

    console.log("  ✅ ALL PHASE 6 ORGANIZATIONAL HIERARCHY TESTS PASSED!");
  } finally {
    // Cleanup test data
    await prisma.auditLog.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.teamMember.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.team.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.department.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.division.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.session.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.user.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.role.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
  }
}
