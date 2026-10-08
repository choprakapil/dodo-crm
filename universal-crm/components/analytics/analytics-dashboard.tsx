"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnalyticsPreset } from "@/lib/validations/analytics";
import { AnalyticsOverviewData, AnalyticsMeta } from "@/lib/services/analytics/types";
import { DateRangePicker } from "./date-range-picker";
import { KpiCard } from "./kpi-card";
import { LeadTrendChart } from "./lead-trend-chart";
import { StatusBreakdownCard } from "./status-breakdown-card";
import { SourceBreakdownCard } from "./source-breakdown-card";
import { PipelineOverviewCard } from "./pipeline-overview-card";
import { TeamPerformanceTable } from "./team-performance-table";
import { ActivityBreakdownCard } from "./activity-breakdown-card";
import { FollowUpHealthCard } from "./follow-up-health-card";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserPlus,
  Trophy,
  Percent,
  DollarSign,
  Clock,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

interface AnalyticsDashboardProps {
  currency?: string;
  initialPreset?: AnalyticsPreset;
}

export function AnalyticsDashboard({
  currency = "USD",
  initialPreset = "LAST_30_DAYS",
}: AnalyticsDashboardProps) {
  const [preset, setPreset] = useState<AnalyticsPreset>(initialPreset);
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsOverviewData | null>(null);
  const [meta, setMeta] = useState<AnalyticsMeta | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("preset", preset || "LAST_30_DAYS");
      if (from && from !== "undefined" && from !== "null" && from.trim() !== "") {
        params.set("from", from.trim());
      }
      if (to && to !== "undefined" && to !== "null" && to.trim() !== "") {
        params.set("to", to.trim());
      }

      const res = await fetch(`/api/v1/analytics/overview?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || "Failed to load dashboard metrics");
      }

      setData(json.data);
      setMeta(json.meta);
    } catch (err: unknown) {
      console.error("Dashboard fetch error:", err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [preset, from, to]);

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const params = new URLSearchParams();
        params.set("preset", preset || "LAST_30_DAYS");
        if (from && from !== "undefined" && from !== "null" && from.trim() !== "") {
          params.set("from", from.trim());
        }
        if (to && to !== "undefined" && to !== "null" && to.trim() !== "") {
          params.set("to", to.trim());
        }

        const res = await fetch(`/api/v1/analytics/overview?${params.toString()}`);
        const json = await res.json();

        if (ignore) return;

        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message || "Failed to load dashboard metrics");
        }

        setData(json.data);
        setMeta(json.meta);
      } catch (err: unknown) {
        if (ignore) return;
        console.error("Dashboard fetch error:", err);
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [preset, from, to]);

  const handleRangeChange = (newPreset: AnalyticsPreset, newFrom?: string, newTo?: string) => {
    setPreset(newPreset);
    setFrom(newFrom);
    setTo(newTo);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Date Range Control Bar */}
      <DateRangePicker
        preset={preset}
        from={from}
        to={to}
        onRangeChange={handleRangeChange}
        onRefresh={fetchOverview}
        loading={loading}
      />

      {/* Error state with retry */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-between gap-4 text-rose-800 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs font-medium">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            onClick={fetchOverview}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs border-rose-300 bg-white hover:bg-rose-100 text-rose-800"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* 6 Core KPI Cards with restrained semantic color system */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard
          title="Total Leads"
          value={data?.kpis.totalLeads ?? 0}
          icon={Users}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50 border-indigo-200/80"
          subtitle="Accessible in scope"
          loading={loading && !data}
        />

        <KpiCard
          title="New Leads"
          value={data?.kpis.newLeads.current ?? 0}
          changePercent={data?.kpis.newLeads.changePercent}
          previousValue={data?.kpis.newLeads.previous}
          icon={UserPlus}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 border-blue-200/80"
          loading={loading && !data}
        />

        <KpiCard
          title="Converted"
          value={data?.kpis.convertedLeads.current ?? 0}
          changePercent={data?.kpis.convertedLeads.changePercent}
          previousValue={data?.kpis.convertedLeads.previous}
          icon={Trophy}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 border-emerald-200/80"
          loading={loading && !data}
        />

        <KpiCard
          title="Conv. Rate"
          value={`${data?.kpis.conversionRate.current ?? 0}%`}
          changePercent={data?.kpis.conversionRate.changePercent}
          previousValue={`${data?.kpis.conversionRate.previous ?? 0}%`}
          icon={Percent}
          iconColor="text-purple-600"
          iconBg="bg-purple-50 border-purple-200/80"
          loading={loading && !data}
        />

        <KpiCard
          title="Pipeline Value"
          value={formatCurrency(data?.kpis.pipelineValue.current ?? 0)}
          changePercent={data?.kpis.pipelineValue.changePercent}
          previousValue={formatCurrency(data?.kpis.pipelineValue.previous ?? 0)}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 border-emerald-200/80"
          loading={loading && !data}
        />

        <KpiCard
          title="Follow-ups Due"
          value={data?.kpis.followUpsDue.dueInPeriod ?? 0}
          subtitle={`${data?.kpis.followUpsDue.overdue ?? 0} overdue · ${data?.kpis.followUpsDue.pending ?? 0} pending`}
          icon={Clock}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 border-amber-200/80"
          loading={loading && !data}
        />
      </div>

      {/* Lead Creation Trend Chart */}
      <LeadTrendChart trends={data?.trends || []} loading={loading && !data} />

      {/* 2-Column: Status Distribution & Source Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <StatusBreakdownCard
          statuses={data?.statuses || []}
          currency={currency}
          loading={loading && !data}
        />
        <SourceBreakdownCard
          sources={data?.sources || []}
          currency={currency}
          loading={loading && !data}
        />
      </div>

      {/* Pipeline Overview & Funnel */}
      {data?.pipeline && (
        <PipelineOverviewCard
          pipeline={data.pipeline}
          currency={currency}
          loading={loading && !data}
        />
      )}

      {/* Team Performance Leaderboard */}
      <TeamPerformanceTable
        team={data?.team || []}
        currency={currency}
        preset={preset}
        from={from}
        to={to}
        loading={loading && !data}
      />

      {/* 2-Column: Activity Breakdown & Follow-up Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ActivityBreakdownCard
          activities={
            data?.activities || {
              total: 0,
              byType: { CALL: 0, WHATSAPP: 0, EMAIL: 0, MEETING: 0, NOTE: 0 },
            }
          }
          loading={loading && !data}
        />
        <FollowUpHealthCard
          followUps={
            data?.followUps || {
              created: 0,
              completed: 0,
              pending: 0,
              overdue: 0,
              completionRate: 0,
            }
          }
          loading={loading && !data}
        />
      </div>

      {/* Footer Timestamp */}
      {meta && (
        <div className="text-right text-[11px] text-slate-500 pt-2 font-mono">
          Last refreshed: {new Date(meta.generatedAt).toLocaleTimeString()} ({meta.timezone})
        </div>
      )}
    </div>
  );
}
