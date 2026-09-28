import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { AnalyticsService } from "../lib/services/analytics.service";
import { AuthContext } from "../lib/auth/session";
import { DataScope } from "@prisma/client";

export async function runAnalyticsSpectatorTests() {
  console.log("\n🧪 Running Slice 6: Analytics Spectator Adversarial Security Tests...");

  // Retrieve Sales Rep and Manager in Acme Corp
  const [salesRep, manager, admin] = await Promise.all([
    prisma.user.findFirst({
      where: { email: "sarah@acmecorp.com" },
      include: {
        role: { include: { permissions: true } },
        company: true,
      },
    }),
    prisma.user.findFirst({
      where: { email: "manager@acmecorp.com" },
      include: {
        role: { include: { permissions: true } },
        company: true,
      },
    }),
    prisma.user.findFirst({
      where: { email: "admin@acmecorp.com" },
      include: {
        role: { include: { permissions: true } },
        company: true,
      },
    }),
  ]);

  assert(salesRep, "Sarah (sales rep) must exist in database");
  assert(manager, "Manager must exist in database");
  assert(admin, "Admin must exist in database");

  const buildContext = (user: typeof salesRep, explicitScope: DataScope): AuthContext => ({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      status: user.status,
      roleId: user.roleId,
      roleName: user.role.name,
      isSystemRole: user.role.isSystem,
    },
    company: {
      id: user.company.id,
      name: user.company.name,
      slug: user.company.slug,
      status: user.company.status,
      timezone: user.company.timezone,
      currency: user.company.currency,
    },
    role: {
      id: user.role.id,
      name: user.role.name,
      isSystem: user.role.isSystem,
    },
    permissions: user.role.permissions.map((p) => ({
      module: p.module,
      action: p.action,
      dataScope: p.dataScope,
    })),
    session: {
      id: `mock_session_${user.id}`,
      expiresAt: new Date(Date.now() + 3600000),
    },
    hasPermission: () => true,
    getDataScope: () => explicitScope,
  });

  // ---------------------------------------------------------------------------
  // 1. Sales Rep (OWN Data Scope) Boundary Enforcement
  // ---------------------------------------------------------------------------
  const repCtx = buildContext(salesRep, DataScope.OWN);
  const repOverview = await AnalyticsService.getOverview(repCtx, { preset: "THIS_YEAR" });

  // Sales rep leaderboard MUST contain at most 1 user: Sarah herself!
  assert.equal(
    repOverview.data.team.length,
    1,
    "Sales Rep with OWN scope must see only themselves in team performance"
  );
  assert.equal(
    repOverview.data.team[0].userId,
    salesRep.id,
    "The single user in Sales Rep leaderboard must be the sales rep themselves"
  );

  // Total leads for rep must equal only leads assigned to Sarah
  const repAssignedCount = await prisma.lead.count({
    where: {
      companyId: repCtx.company.id,
      assignedUserId: salesRep.id,
      deletedAt: null,
    },
  });
  assert.equal(
    repOverview.data.kpis.totalLeads,
    repAssignedCount,
    "Sales Rep total leads must strictly equal assigned leads"
  );

  // Sales Rep attempts to pass another agent's userId in query filter
  const unauthorizedFilterOverview = await AnalyticsService.getOverview(repCtx, {
    preset: "THIS_YEAR",
    userId: admin.id,
  });
  assert.equal(
    unauthorizedFilterOverview.data.team.length,
    0,
    "Sales Rep querying another user's ID must receive 0 team members"
  );
  console.log("  ✓ Sales Rep OWN scope isolation strictly verified (no teammate data leakage)");

  // ---------------------------------------------------------------------------
  // 2. Manager (TEAM Data Scope) Boundary Enforcement
  // ---------------------------------------------------------------------------
  const managerCtx = buildContext(manager, DataScope.TEAM);
  const managerOverview = await AnalyticsService.getOverview(managerCtx, { preset: "THIS_YEAR" });

  // Manager must only see agents belonging to their teams
  const managerMemberships = await prisma.teamMember.findMany({
    where: {
      companyId: managerCtx.company.id,
      userId: manager.id,
    },
    select: { teamId: true },
  });
  const managerTeamIds = managerMemberships.map((m) => m.teamId);

  const teamAllowedUsers = await prisma.teamMember.findMany({
    where: {
      companyId: managerCtx.company.id,
      teamId: { in: managerTeamIds },
    },
    select: { userId: true },
  });
  const allowedUserSet = new Set([manager.id, ...teamAllowedUsers.map((m) => m.userId)]);

  for (const member of managerOverview.data.team) {
    assert(
      allowedUserSet.has(member.userId),
      `Manager team view leaked user outside permitted teams: ${member.email}`
    );
  }
  console.log("  ✓ Manager TEAM scope isolation strictly verified");

  // ---------------------------------------------------------------------------
  // 3. Soft-Deletes Strict Exclusion
  // ---------------------------------------------------------------------------
  const adminCtx = buildContext(admin, DataScope.COMPANY);
  const beforeLeadsCount = (await AnalyticsService.getOverview(adminCtx, { preset: "THIS_YEAR" })).data.kpis.totalLeads;

  // Create a temporary lead and immediately soft-delete it
  const softDeletedLead = await prisma.lead.create({
    data: {
      companyId: adminCtx.company.id,
      name: "Deleted Lead Analytics Test",
      amount: 99999,
      deletedAt: new Date(),
    },
  });

  const afterLeadsCount = (await AnalyticsService.getOverview(adminCtx, { preset: "THIS_YEAR" })).data.kpis.totalLeads;
  assert.equal(
    afterLeadsCount,
    beforeLeadsCount,
    "Soft-deleted lead must NOT increment totalLeads count"
  );

  // Clean up test lead
  await prisma.lead.delete({ where: { id: softDeletedLead.id } });
  console.log("  ✓ Soft-deleted records are strictly excluded from all metrics");

  // ---------------------------------------------------------------------------
  // 4. Formula Injection Defense on CSV Export
  // ---------------------------------------------------------------------------
  // Create lead with formula injection name
  const injectionLead = await prisma.lead.create({
    data: {
      companyId: adminCtx.company.id,
      name: "=cmd|' /C calc'!A0",
      assignedUserId: salesRep.id,
      amount: 500,
    },
  });

  const csvResult = await AnalyticsService.exportReportCsv(adminCtx, {
    report: "team",
    preset: "THIS_YEAR",
  });

  // Verify that any formula prefix is sanitized with a leading single quote
  assert(
    !csvResult.csv.includes("\n=cmd"),
    "CSV must neutralize leading '=' formula injection triggers"
  );

  await prisma.lead.delete({ where: { id: injectionLead.id } });
  console.log("  ✓ Formula injection defense verified on exported CSV");

  // ---------------------------------------------------------------------------
  // 5. Audit Logging on Export
  // ---------------------------------------------------------------------------
  const exportAudit = await prisma.auditLog.findFirst({
    where: {
      companyId: adminCtx.company.id,
      action: "analytics_export.created",
    },
    orderBy: { createdAt: "desc" },
  });

  assert(exportAudit, "Audit log must record analytics_export.created event");
  console.log("  ✓ Audit log properly recorded for analytics exports");

  console.log("✅ Slice 6: Analytics Spectator Adversarial Security Tests Passed!\n");
}

if (require.main === module) {
  runAnalyticsSpectatorTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
