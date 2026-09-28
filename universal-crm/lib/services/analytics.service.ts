import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { getReportsDataScope } from "@/lib/auth/scope";
import { AnalyticsQuery, AnalyticsExportQuery } from "@/lib/validations/analytics";
import {
  AnalyticsOverviewResponse,
  AnalyticsOverviewData,
  AnalyticsMeta,
} from "./analytics/types";
import { resolveDateRange } from "./analytics/date-range";
import { getLeadsAnalytics } from "./analytics/leads.analytics";
import { getPipelineAnalytics } from "./analytics/pipeline.analytics";
import { getStatusAnalytics } from "./analytics/statuses.analytics";
import { getSourceAnalytics } from "./analytics/sources.analytics";
import { getActivityAnalytics } from "./analytics/activities.analytics";
import { getFollowUpAnalytics } from "./analytics/followups.analytics";
import { getTeamAnalytics } from "./analytics/team.analytics";
import { serializeCsv, sanitizeFormulaInjection } from "@/lib/utils/csv";

export class AnalyticsService {
  /**
   * Retrieves the comprehensive dashboard overview dataset within tenant & data scope.
   */
  static async getOverview(
    ctx: AuthContext,
    query: AnalyticsQuery
  ): Promise<AnalyticsOverviewResponse> {
    // 1. Verify authorization
    getReportsDataScope(ctx, "view");

    // 2. Resolve date range and comparison periods
    const range = resolveDateRange({
      preset: query.preset,
      from: query.from,
      to: query.to,
      timezone: ctx.company.timezone || "UTC",
    });

    // 3. Identify tenant's configured converted and lost statuses
    const tenantStatuses = await prisma.leadStatus.findMany({
      where: { companyId: ctx.company.id },
      select: { id: true, name: true },
    });

    const convertedStatusIds = tenantStatuses
      .filter((s) => /convert|won/i.test(s.name))
      .map((s) => s.id);

    const lostStatusIds = tenantStatuses
      .filter((s) => /lost/i.test(s.name))
      .map((s) => s.id);

    const filterOpts = {
      teamId: query.teamId,
      userId: query.userId,
      statusId: query.statusId,
      sourceId: query.sourceId,
    };

    // 4. Concurrently execute all domain aggregations
    const [
      leadsData,
      pipelineData,
      statuses,
      sources,
      activities,
      followUpData,
      team,
    ] = await Promise.all([
      getLeadsAnalytics(ctx, range, convertedStatusIds, filterOpts),
      getPipelineAnalytics(ctx, range, convertedStatusIds, lostStatusIds, filterOpts),
      getStatusAnalytics(ctx, filterOpts),
      getSourceAnalytics(ctx, filterOpts),
      getActivityAnalytics(ctx, range, filterOpts),
      getFollowUpAnalytics(ctx, range, filterOpts),
      getTeamAnalytics(ctx, range, convertedStatusIds, filterOpts),
    ]);

    const overviewData: AnalyticsOverviewData = {
      kpis: {
        totalLeads: leadsData.totalLeads,
        newLeads: leadsData.newLeads,
        convertedLeads: leadsData.convertedLeads,
        conversionRate: leadsData.conversionRate,
        pipelineValue: pipelineData.pipelineKpi,
        followUpsDue: {
          dueInPeriod: followUpData.dueInPeriod,
          pending: followUpData.followUps.pending,
          overdue: followUpData.followUps.overdue,
        },
      },
      trends: leadsData.trends,
      statuses,
      sources,
      pipeline: pipelineData.pipeline,
      velocity: leadsData.velocity,
      team,
      activities,
      followUps: followUpData.followUps,
    };

    const meta: AnalyticsMeta = {
      preset: range.preset,
      from: range.current.start.toISOString(),
      to: range.current.end.toISOString(),
      previousFrom: range.previous.start.toISOString(),
      previousTo: range.previous.end.toISOString(),
      timezone: range.timezone,
      generatedAt: new Date().toISOString(),
    };

    return {
      data: overviewData,
      meta,
    };
  }

  /**
   * Generates a formula-safe CSV export for analytics reports.
   */
  static async exportReportCsv(
    ctx: AuthContext,
    query: AnalyticsExportQuery
  ): Promise<{ csv: string; filename: string }> {
    // 1. Verify export authorization
    getReportsDataScope(ctx, "export");

    const overview = await this.getOverview(ctx, {
      preset: query.preset,
      from: query.from,
      to: query.to,
      teamId: query.teamId,
      userId: query.userId,
      statusId: query.statusId,
      sourceId: query.sourceId,
    });

    let headers: string[] = [];
    let rows: Record<string, string>[] = [];
    const reportType = query.report;
    const dateStr = new Date().toISOString().slice(0, 10);

    switch (reportType) {
      case "team": {
        headers = [
          "Agent Name",
          "Email",
          "Role",
          "Assigned Leads",
          "New Leads",
          "Converted Leads",
          "Conversion Rate (%)",
          "Pipeline Value",
          "Follow-ups Completed",
          "Follow-ups Overdue",
          "Total Activities",
          "Calls",
          "WhatsApp",
          "Emails",
          "Meetings",
        ];
        rows = overview.data.team.map((t) => ({
          "Agent Name": sanitizeFormulaInjection(t.name),
          Email: sanitizeFormulaInjection(t.email),
          Role: sanitizeFormulaInjection(t.roleName),
          "Assigned Leads": String(t.assignedLeads),
          "New Leads": String(t.newLeads),
          "Converted Leads": String(t.convertedLeads),
          "Conversion Rate (%)": `${t.conversionRate}%`,
          "Pipeline Value": String(t.pipelineValue),
          "Follow-ups Completed": String(t.completedFollowUps),
          "Follow-ups Overdue": String(t.overdueFollowUps),
          "Total Activities": String(t.activitiesCount),
          Calls: String(t.calls),
          WhatsApp: String(t.whatsApp),
          Emails: String(t.emails),
          Meetings: String(t.meetings),
        }));
        break;
      }

      case "statuses": {
        headers = ["Status Name", "Lead Count", "Share (%)", "Pipeline Value"];
        rows = overview.data.statuses.map((s) => ({
          "Status Name": sanitizeFormulaInjection(s.name),
          "Lead Count": String(s.count),
          "Share (%)": `${s.percentage}%`,
          "Pipeline Value": String(s.value),
        }));
        break;
      }

      case "sources": {
        headers = ["Source Name", "Lead Count", "Share (%)", "Pipeline Value"];
        rows = overview.data.sources.map((s) => ({
          "Source Name": sanitizeFormulaInjection(s.name),
          "Lead Count": String(s.count),
          "Share (%)": `${s.percentage}%`,
          "Pipeline Value": String(s.value),
        }));
        break;
      }

      case "pipeline": {
        headers = [
          "Stage Name",
          "Lead Count",
          "Pipeline Value",
          "Share of Pipeline (%)",
        ];
        rows = overview.data.pipeline.stages.map((st) => ({
          "Stage Name": sanitizeFormulaInjection(st.stageName),
          "Lead Count": String(st.leadCount),
          "Pipeline Value": String(st.totalValue),
          "Share of Pipeline (%)": `${st.percentageOfPipeline}%`,
        }));
        break;
      }

      case "activities": {
        headers = ["Activity Type", "Count"];
        rows = [
          { "Activity Type": "Calls", Count: String(overview.data.activities.byType.CALL) },
          { "Activity Type": "WhatsApp", Count: String(overview.data.activities.byType.WHATSAPP) },
          { "Activity Type": "Emails", Count: String(overview.data.activities.byType.EMAIL) },
          { "Activity Type": "Meetings", Count: String(overview.data.activities.byType.MEETING) },
          { "Activity Type": "Notes", Count: String(overview.data.activities.byType.NOTE) },
        ];
        break;
      }
    }

    const csv = serializeCsv(rows, headers);
    const filename = `analytics-${reportType}-${dateStr}.csv`;

    // Record audit log for export action
    try {
      await prisma.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "analytics_export.created",
          entityType: "Analytics",
          entityId: reportType,
          metadata: {
            report: reportType,
            preset: query.preset,
            rowCount: rows.length,
          },
        },
      });
    } catch {
      // Non-blocking audit failure
    }

    return { csv, filename };
  }
}
