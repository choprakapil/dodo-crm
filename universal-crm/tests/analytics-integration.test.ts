import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { AnalyticsService } from "../lib/services/analytics.service";
import { AuthContext } from "../lib/auth/session";
import { DataScope } from "@prisma/client";

export async function runAnalyticsIntegrationTests() {
  console.log("\n🧪 Running Slice 6: Analytics Integration Tests...");

  // Retrieve seeded Acme admin user and company
  const acmeAdmin = await prisma.user.findFirst({
    where: { email: "admin@acmecorp.com" },
    include: {
      role: {
        include: {
          permissions: true,
        },
      },
      company: true,
    },
  });

  assert(acmeAdmin, "Acme admin user must exist in database");

  const permissions = acmeAdmin.role.permissions.map((p) => ({
    module: p.module,
    action: p.action,
    dataScope: p.dataScope,
  }));

  const mockCtx: AuthContext = {
    user: {
      id: acmeAdmin.id,
      email: acmeAdmin.email,
      name: acmeAdmin.name,
      phone: acmeAdmin.phone,
      status: acmeAdmin.status,
      roleId: acmeAdmin.roleId,
      roleName: acmeAdmin.role.name,
      isSystemRole: acmeAdmin.role.isSystem,
    },
    company: {
      id: acmeAdmin.company.id,
      name: acmeAdmin.company.name,
      slug: acmeAdmin.company.slug,
      status: acmeAdmin.company.status,
      timezone: acmeAdmin.company.timezone,
      currency: acmeAdmin.company.currency,
    },
    role: {
      id: acmeAdmin.role.id,
      name: acmeAdmin.role.name,
      isSystem: acmeAdmin.role.isSystem,
    },
    permissions,
    session: {
      id: "mock_session_analytics_admin",
      expiresAt: new Date(Date.now() + 3600000),
    },
    hasPermission: () => true,
    getDataScope: () => DataScope.COMPANY,
  };

  // ---------------------------------------------------------------------------
  // 1. Dashboard Overview Aggregations
  // ---------------------------------------------------------------------------
  const overview = await AnalyticsService.getOverview(mockCtx, {
    preset: "LAST_30_DAYS",
  });

  assert(overview.data, "Overview must return data object");
  assert(overview.meta, "Overview must return meta object");

  // Verify KPIs
  const { kpis } = overview.data;
  assert(typeof kpis.totalLeads === "number" && kpis.totalLeads >= 0, "totalLeads must be non-negative");
  assert(typeof kpis.newLeads.current === "number", "newLeads.current must be number");
  assert(typeof kpis.newLeads.changePercent === "number", "newLeads.changePercent must be number");
  assert(typeof kpis.convertedLeads.current === "number", "convertedLeads must be number");
  assert(typeof kpis.conversionRate.current === "number", "conversionRate must be number");
  assert(typeof kpis.pipelineValue.current === "number", "pipelineValue must be number");
  assert(typeof kpis.followUpsDue.dueInPeriod === "number", "followUpsDue must be number");
  console.log(`  ✓ Executive KPIs aggregated: ${kpis.totalLeads} total leads, $${kpis.pipelineValue.current} pipeline`);

  // Verify Trends
  assert(Array.isArray(overview.data.trends), "trends must be an array");
  assert(overview.data.trends.length > 0, "trends should have bucketed data points");
  assert(typeof overview.data.trends[0].leads === "number", "trend points must have leads count");
  assert(typeof overview.data.trends[0].label === "string", "trend points must have display label");
  console.log(`  ✓ Trend time-series generated with ${overview.data.trends.length} continuous points`);

  // Verify Statuses Breakdown
  assert(Array.isArray(overview.data.statuses), "statuses must be an array");
  assert(overview.data.statuses.length > 0, "must include tenant statuses");
  for (const st of overview.data.statuses) {
    assert(st.id && st.name && st.color, "status must have id, name, color");
    assert(typeof st.count === "number" && st.count >= 0, "status count must be non-negative");
    assert(typeof st.percentage === "number", "status percentage must be number");
  }
  console.log(`  ✓ Status breakdown returned ${overview.data.statuses.length} tenant stages`);

  // Verify Sources Breakdown
  assert(Array.isArray(overview.data.sources), "sources must be an array");
  assert(overview.data.sources.length > 0, "must include tenant sources");
  for (const src of overview.data.sources) {
    assert(src.id && src.name, "source must have id and name");
    assert(typeof src.count === "number", "source count must be number");
  }
  console.log(`  ✓ Source breakdown returned ${overview.data.sources.length} acquisition channels`);

  // Verify Pipeline Stages
  assert(overview.data.pipeline, "pipeline object must exist");
  assert(typeof overview.data.pipeline.totalValue === "number", "totalValue must be number");
  assert(typeof overview.data.pipeline.avgDealValue === "number", "avgDealValue must be number");
  assert(Array.isArray(overview.data.pipeline.stages), "pipeline stages must be array");
  console.log(`  ✓ Pipeline overview calculated: $${overview.data.pipeline.totalValue} across ${overview.data.pipeline.stages.length} stages`);

  // Verify Velocity
  assert(typeof overview.data.velocity.leadsPerDay === "number", "leadsPerDay must be number");
  assert(typeof overview.data.velocity.leadsPerWeek === "number", "leadsPerWeek must be number");
  console.log(`  ✓ Lead velocity calculated: ${overview.data.velocity.leadsPerDay} leads/day`);

  // Verify Team Performance
  assert(Array.isArray(overview.data.team), "team must be an array");
  assert(overview.data.team.length > 0, "team should contain active company users");
  for (const member of overview.data.team) {
    assert(member.userId && member.name && member.email, "member must have id, name, email");
    assert(typeof member.assignedLeads === "number", "assignedLeads must be number");
    assert(typeof member.pipelineValue === "number", "pipelineValue must be number");
    assert(typeof member.activitiesCount === "number", "activitiesCount must be number");
  }
  console.log(`  ✓ Team performance leaderboard calculated for ${overview.data.team.length} agents`);

  // Verify Activities & Follow-ups
  assert(typeof overview.data.activities.total === "number", "activities total must be number");
  assert(typeof overview.data.followUps.completionRate === "number", "completionRate must be number");
  console.log(`  ✓ Activities total: ${overview.data.activities.total}, Follow-up completion rate: ${overview.data.followUps.completionRate}%`);

  // ---------------------------------------------------------------------------
  // 2. CSV Reports Export
  // ---------------------------------------------------------------------------
  const teamExport = await AnalyticsService.exportReportCsv(mockCtx, {
    report: "team",
    preset: "LAST_30_DAYS",
  });
  assert(teamExport.csv.includes("Agent Name"), "CSV must include headers");
  assert(teamExport.filename.startsWith("analytics-team-"), "filename must follow naming convention");

  const statusExport = await AnalyticsService.exportReportCsv(mockCtx, {
    report: "statuses",
    preset: "THIS_MONTH",
  });
  assert(statusExport.csv.includes("Status Name"), "Statuses CSV must include Status Name header");

  const pipelineExport = await AnalyticsService.exportReportCsv(mockCtx, {
    report: "pipeline",
    preset: "THIS_YEAR",
  });
  assert(pipelineExport.csv.includes("Stage Name"), "Pipeline CSV must include Stage Name header");

  console.log("  ✓ Analytics CSV export generated successfully for team, statuses, and pipeline");

  console.log("✅ Slice 6: Analytics Integration Tests Passed!\n");
}

if (require.main === module) {
  runAnalyticsIntegrationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
