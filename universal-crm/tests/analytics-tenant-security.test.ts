import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { AnalyticsService } from "../lib/services/analytics.service";
import { AuthContext } from "../lib/auth/session";
import { DataScope } from "@prisma/client";

export async function runAnalyticsTenantSecurityTests() {
  console.log("\n🧪 Running Slice 6: Analytics Tenant Security Tests...");

  // Retrieve Acme Admin and Zenith Admin
  const [acmeAdmin, zenithAdmin] = await Promise.all([
    prisma.user.findFirst({
      where: { email: "admin@acmecorp.com" },
      include: {
        role: { include: { permissions: true } },
        company: true,
      },
    }),
    prisma.user.findFirst({
      where: { email: "admin@zenithsolutions.com" },
      include: {
        role: { include: { permissions: true } },
        company: true,
      },
    }),
  ]);

  assert(acmeAdmin, "Acme admin must exist");
  assert(zenithAdmin, "Zenith admin must exist");
  assert.notEqual(acmeAdmin.companyId, zenithAdmin.companyId, "Acme and Zenith must have distinct tenant IDs");

  const buildContext = (user: typeof acmeAdmin): AuthContext => ({
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
    getDataScope: () => DataScope.COMPANY,
  });

  const acmeCtx = buildContext(acmeAdmin);
  const zenithCtx = buildContext(zenithAdmin);

  // ---------------------------------------------------------------------------
  // 1. Cross-Tenant Total Counts Verification
  // ---------------------------------------------------------------------------
  const [acmeOverview, zenithOverview] = await Promise.all([
    AnalyticsService.getOverview(acmeCtx, { preset: "THIS_YEAR" }),
    AnalyticsService.getOverview(zenithCtx, { preset: "THIS_YEAR" }),
  ]);

  // Count leads directly in database for ground truth
  const [actualAcmeLeads, actualZenithLeads] = await Promise.all([
    prisma.lead.count({ where: { companyId: acmeCtx.company.id, deletedAt: null } }),
    prisma.lead.count({ where: { companyId: zenithCtx.company.id, deletedAt: null } }),
  ]);

  assert.equal(
    acmeOverview.data.kpis.totalLeads,
    actualAcmeLeads,
    "Acme analytics total leads must match actual Acme count"
  );
  assert.equal(
    zenithOverview.data.kpis.totalLeads,
    actualZenithLeads,
    "Zenith analytics total leads must match actual Zenith count"
  );
  console.log(`  ✓ Tenant isolation verified: Acme leads (${actualAcmeLeads}) vs Zenith leads (${actualZenithLeads})`);

  // Verify status sets are strictly isolated
  const acmeStatusNames = acmeOverview.data.statuses.map((s) => s.id);
  const zenithStatusesInDb = await prisma.leadStatus.findMany({
    where: { companyId: zenithCtx.company.id },
    select: { id: true },
  });
  const zenithStatusIds = new Set(zenithStatusesInDb.map((s) => s.id));

  for (const statusId of acmeStatusNames) {
    assert(
      !zenithStatusIds.has(statusId),
      `Acme analytics status list leaked Zenith status ID: ${statusId}`
    );
  }
  console.log("  ✓ Status breakdown is strictly tenant-scoped");

  // Verify team members are strictly isolated
  const acmeUserIds = new Set(acmeOverview.data.team.map((t) => t.userId));
  const zenithUser = await prisma.user.findFirst({
    where: { companyId: zenithCtx.company.id },
  });
  if (zenithUser) {
    assert(
      !acmeUserIds.has(zenithUser.id),
      `Acme team leaderboard leaked Zenith user: ${zenithUser.email}`
    );
  }
  console.log("  ✓ Team leaderboard is strictly tenant-scoped");

  // ---------------------------------------------------------------------------
  // 2. Foreign ID Filter Injection Attack (IDOR Defense)
  // ---------------------------------------------------------------------------
  // Attempt to pass Zenith status ID into Acme's query
  if (zenithStatusesInDb.length > 0) {
    const foreignStatusId = zenithStatusesInDb[0].id;
    const injectedStatusOverview = await AnalyticsService.getOverview(acmeCtx, {
      preset: "THIS_YEAR",
      statusId: foreignStatusId,
    });

    assert.equal(
      injectedStatusOverview.data.kpis.totalLeads,
      0,
      "Query with foreign statusId must return 0 leads and never leak data"
    );
  }

  // Attempt to pass Zenith user ID into Acme's query
  if (zenithUser) {
    const injectedUserOverview = await AnalyticsService.getOverview(acmeCtx, {
      preset: "THIS_YEAR",
      userId: zenithUser.id,
    });

    assert.equal(
      injectedUserOverview.data.kpis.totalLeads,
      0,
      "Query with foreign userId must return 0 leads and never leak data"
    );
  }
  console.log("  ✓ Foreign ID injection attacks successfully neutralized with 0 leaked data");

  console.log("✅ Slice 6: Analytics Tenant Security Tests Passed!\n");
}

if (require.main === module) {
  runAnalyticsTenantSecurityTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
