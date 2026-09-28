"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Briefcase,
  Layers,
  Activity,
  Plus,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TelemetryData {
  metrics: {
    companies: { total: number; active: number; suspended: number };
    users: { total: number; active: number };
    leads: { total: number };
    teams: { total: number };
  };
  planDistribution: Array<{
    id: string;
    name: string;
    code: string;
    subscriberCount: number;
    maxUsers: number;
    maxLeads: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    superAdmin: { email: string; name: string } | null;
    createdAt: string;
  }>;
  platformHealth: {
    status: string;
    database: string;
    latencyMs: number;
    timestamp: string;
  };
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/dashboard");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || "Failed to load telemetry data.");
      }
    } catch {
      setError("Network error while connecting to platform API.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Platform Overview
          </h1>
          <p className="text-xs text-slate-500">
            Global telemetry, multi-tenant fleet health, and operational activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTelemetry}
            disabled={isLoading}
            className="text-xs"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/admin/companies/new">
            <Button size="sm" className="bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500">
              <Plus className="mr-1.5 h-4 w-4" />
              Provision Company
            </Button>
          </Link>
        </div>
      </div>

      {/* Health / Readiness Banner */}
      {data?.platformHealth && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </span>
            <span className="font-semibold">Platform Status: HEALTHY</span>
            <span className="text-emerald-700">
              • Database: {data.platformHealth.database} ({data.platformHealth.latencyMs}ms)
            </span>
          </div>
          <span className="text-[11px] text-emerald-700">
            {new Date(data.platformHealth.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Companies */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Companies</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data?.metrics.companies.total ?? 0}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-emerald-600">
              {data?.metrics.companies.active ?? 0} Active
            </span>
            <span>•</span>
            <span className="font-medium text-amber-600">
              {data?.metrics.companies.suspended ?? 0} Suspended
            </span>
          </div>
        </div>

        {/* Total Platform Users */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Users</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data?.metrics.users.total ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <span className="font-medium text-emerald-600">
              {data?.metrics.users.active ?? 0} Active
            </span>{" "}
            across all tenant accounts
          </div>
        </div>

        {/* Global Leads */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Global Leads</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data?.metrics.leads.total ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Total CRM pipeline entities
          </div>
        </div>

        {/* Total Teams */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Teams</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Briefcase className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {data?.metrics.teams.total ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Active organizational units
          </div>
        </div>
      </div>

      {/* Grid: Plan Distribution & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Plan Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              Subscription Tiers
            </h2>
            <Link href="/admin/plans" className="text-xs font-medium text-indigo-600 hover:underline">
              Manage
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {data?.planDistribution.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-800">{plan.name}</span>
                  <div className="text-[11px] text-slate-500">
                    Max: {plan.maxUsers} Users • {plan.maxLeads.toLocaleString()} Leads
                  </div>
                </div>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                  {plan.subscriberCount} {plan.subscriberCount === 1 ? "co" : "cos"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Platform Audit Activity */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-700" />
              Recent Platform Actions
            </h2>
            <Link href="/admin/audit-logs" className="text-xs font-medium text-indigo-600 hover:underline">
              View All
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.recentActivity && data.recentActivity.length > 0 ? (
                  data.recentActivity.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {log.entityType} {log.entityId ? `(${log.entityId.slice(0, 8)}...)` : ""}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {log.superAdmin?.email ?? "System"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No platform events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
