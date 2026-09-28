"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Users,
  Briefcase,
  Activity,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Layers,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompanyDetailData {
  company: {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "SUSPENDED";
    email: string | null;
    phone: string | null;
    website: string | null;
    timezone: string;
    currency: string;
    dateFormat: string;
    createdAt: string;
    updatedAt: string;
  };
  plan: {
    id: string;
    name: string;
    code: string;
    maxUsers: number;
    maxLeads: number;
    features: Record<string, boolean>;
  } | null;
  quota: {
    users: { current: number; max: number; remaining: number; isExceeded: boolean; percentage: number };
    leads: { current: number; max: number; remaining: number; isExceeded: boolean; percentage: number };
  };
  statistics: {
    users: number;
    teams: number;
    leads: number;
    activities: number;
    followUps: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    metadata: Record<string, unknown> | null;
    superAdmin: { email: string; name: string } | null;
    createdAt: string;
    ipAddress: string | null;
  }>;
}

export default function CompanyInspectorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<CompanyDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlanTier, setSelectedPlanTier] = useState("STARTER");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/companies/${id}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (json.data.plan?.code) {
          setSelectedPlanTier(json.data.plan.code);
        }
      } else {
        setError(json.error?.message || "Failed to load company details.");
      }
    } catch {
      setError("Network error while connecting to platform API.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleSuspend = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: suspendReason }),
      });
      const json = await res.json();
      if (json.success) {
        setShowSuspendModal(false);
        setSuspendReason("");
        fetchDetails();
      } else {
        alert(json.error?.message || "Failed to suspend company.");
      }
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!confirm("Are you sure you want to reactivate this company? Users will regain access immediately.")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${id}/reactivate`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        fetchDetails();
      } else {
        alert(json.error?.message || "Failed to reactivate company.");
      }
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${id}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: selectedPlanTier }),
      });
      const json = await res.json();
      if (json.success) {
        setShowPlanModal(false);
        fetchDetails();
      } else {
        alert(json.error?.message || "Failed to update plan.");
      }
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-xs text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-600" />
        Inspecting tenant platform records...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-xs text-red-700">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <p className="font-semibold">{error || "Company not found."}</p>
        <Link href="/admin/companies" className="mt-4 inline-block text-indigo-600 hover:underline">
          Return to Fleet List
        </Link>
      </div>
    );
  }

  const { company, plan, quota, statistics, recentAuditLogs } = data;

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          href="/admin/companies"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Fleet List
        </Link>
      </div>

      {/* Tenant Header & Actions */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700 text-lg">
            {company.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  company.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {company.status}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-mono">
              <span>slug: {company.slug}</span>
              <span>•</span>
              <span>ID: {company.id}</span>
            </div>
          </div>
        </div>

        {/* Operational Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPlanModal(true)}
            className="text-xs"
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Change Plan ({plan?.name ?? "Starter"})
          </Button>

          {company.status === "ACTIVE" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSuspendModal(true)}
              className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
              Suspend Company
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReactivate}
              disabled={actionLoading}
              className="text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
              Reactivate Company
            </Button>
          )}
        </div>
      </div>

      {/* Quota Usage Meters */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* User Seats Quota */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-600" />
              User Seats Quota
            </span>
            <span className="text-xs font-bold text-slate-900">
              {quota.users.current} / {quota.users.max} seats ({quota.users.percentage}%)
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-300 ${
                quota.users.percentage >= 100
                  ? "bg-red-500"
                  : quota.users.percentage > 80
                  ? "bg-amber-500"
                  : "bg-indigo-600"
              }`}
              style={{ width: `${Math.min(100, quota.users.percentage)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{quota.users.remaining} seats remaining</span>
            <span>Plan: {plan?.name}</span>
          </div>
        </div>

        {/* Lead Capacity Quota */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-blue-600" />
              Lead Capacity Quota
            </span>
            <span className="text-xs font-bold text-slate-900">
              {quota.leads.current.toLocaleString()} / {quota.leads.max.toLocaleString()} leads ({quota.leads.percentage}%)
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-300 ${
                quota.leads.percentage >= 100
                  ? "bg-red-500"
                  : quota.leads.percentage > 80
                  ? "bg-amber-500"
                  : "bg-blue-600"
              }`}
              style={{ width: `${Math.min(100, quota.leads.percentage)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{quota.leads.remaining.toLocaleString()} leads remaining</span>
            <span>Plan: {plan?.name}</span>
          </div>
        </div>
      </div>

      {/* Tenant Entity Statistics Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <Users className="mx-auto h-5 w-5 text-indigo-600 mb-1" />
          <span className="text-xl font-bold text-slate-900">{statistics.users}</span>
          <span className="block text-[11px] text-slate-500 font-medium">Active Users</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <Briefcase className="mx-auto h-5 w-5 text-purple-600 mb-1" />
          <span className="text-xl font-bold text-slate-900">{statistics.teams}</span>
          <span className="block text-[11px] text-slate-500 font-medium">Teams</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <Building2 className="mx-auto h-5 w-5 text-blue-600 mb-1" />
          <span className="text-xl font-bold text-slate-900">{statistics.leads}</span>
          <span className="block text-[11px] text-slate-500 font-medium">Leads</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <Activity className="mx-auto h-5 w-5 text-amber-600 mb-1" />
          <span className="text-xl font-bold text-slate-900">{statistics.activities}</span>
          <span className="block text-[11px] text-slate-500 font-medium">Activities</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
          <CalendarCheck className="mx-auto h-5 w-5 text-emerald-600 mb-1" />
          <span className="text-xl font-bold text-slate-900">{statistics.followUps}</span>
          <span className="block text-[11px] text-slate-500 font-medium">Follow-ups</span>
        </div>
      </div>

      {/* Details & Platform Audit Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Company Configuration Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
            Tenant Configuration
          </h2>
          <dl className="mt-3 divide-y divide-slate-100 text-xs">
            <div className="py-2 flex justify-between">
              <dt className="text-slate-500">Contact Email</dt>
              <dd className="font-medium text-slate-900">{company.email || "—"}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-slate-500">Phone</dt>
              <dd className="font-medium text-slate-900">{company.phone || "—"}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-slate-500">Timezone</dt>
              <dd className="font-medium text-slate-900">{company.timezone}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-slate-500">Currency</dt>
              <dd className="font-medium text-slate-900">{company.currency}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-slate-500">Date Format</dt>
              <dd className="font-medium text-slate-900">{company.dateFormat}</dd>
            </div>
            <div className="py-2 flex justify-between">
              <dt className="text-slate-500">Created At</dt>
              <dd className="font-medium text-slate-900">
                {new Date(company.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Platform Audit Trail for this Tenant */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-slate-500" />
            Recent Platform Audit Trail
          </h2>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-[11px] font-medium text-slate-400 uppercase">
                <tr>
                  <th className="py-2">Action</th>
                  <th className="py-2">Actor</th>
                  <th className="py-2">IP Address</th>
                  <th className="py-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAuditLogs && recentAuditLogs.length > 0 ? (
                  recentAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 font-medium text-slate-800">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px]">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-600">{log.superAdmin?.email ?? "System"}</td>
                      <td className="py-2.5 text-slate-400 font-mono text-[11px]">{log.ipAddress || "—"}</td>
                      <td className="py-2.5 text-right text-slate-500 text-[11px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      No platform events recorded for this company yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Suspend Confirmation Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900">Suspend {company.name}?</h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Suspending this company will <strong>immediately terminate all active user sessions</strong> and block all subsequent logins.
              Historical tenant records (leads, notes, tasks) will remain preserved in the database.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700">
                Reason for suspension (Optional)
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Non-payment, violation of terms, compliance review"
                className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                rows={3}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSuspendModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSuspend}
                disabled={actionLoading}
                className="bg-red-600 font-medium text-white hover:bg-red-500"
              >
                {actionLoading ? "Suspending..." : "Confirm Suspension"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 text-indigo-600">
              <Layers className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900">Change Subscription Plan</h3>
            </div>
            <p className="mt-2 text-xs text-slate-600">
              Select a new subscription tier for <strong>{company.name}</strong>. Quota limits and feature gates will update immediately.
            </p>

            <div className="mt-4 space-y-2.5">
              {[
                { code: "FREE", name: "Free", users: 2, leads: 100 },
                { code: "STARTER", name: "Starter", users: 5, leads: 1000 },
                { code: "PROFESSIONAL", name: "Professional", users: 25, leads: 10000 },
                { code: "ENTERPRISE", name: "Enterprise", users: 100, leads: 100000 },
              ].map((tier) => (
                <label
                  key={tier.code}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-xs transition-colors ${
                    selectedPlanTier === tier.code
                      ? "border-indigo-600 bg-indigo-50/60 text-indigo-950 font-semibold"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="planTier"
                      value={tier.code}
                      checked={selectedPlanTier === tier.code}
                      onChange={(e) => setSelectedPlanTier(e.target.value)}
                      className="text-indigo-600"
                    />
                    <span>{tier.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {tier.users} Users • {tier.leads.toLocaleString()} Leads
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPlanModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleChangePlan}
                disabled={actionLoading}
                className="bg-indigo-600 font-medium text-white hover:bg-indigo-500"
              >
                {actionLoading ? "Updating..." : "Save Plan Assignment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
