"use client";

import { useEffect, useState } from "react";
import {
  Layers,
  Users,
  Activity,
  Check,
  X,
  Edit2,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlanItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  maxUsers: number;
  maxLeads: number;
  features: Record<string, boolean>;
  isActive: boolean;
  subscriberCount: number;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal State
  const [editingPlan, setEditingPlan] = useState<PlanItem | null>(null);
  const [editMaxUsers, setEditMaxUsers] = useState<number>(5);
  const [editMaxLeads, setEditMaxLeads] = useState<number>(1000);
  const [editFeatures, setEditFeatures] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/admin/plans");
      const json = await res.json();
      if (json.success) {
        setPlans(json.data);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openEditModal = (plan: PlanItem) => {
    setEditingPlan(plan);
    setEditMaxUsers(plan.maxUsers);
    setEditMaxLeads(plan.maxLeads);
    setEditFeatures({ ...plan.features });
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUsers: editMaxUsers,
          maxLeads: editMaxLeads,
          features: editFeatures,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setEditingPlan(null);
        fetchPlans();
      } else {
        alert(json.error?.message || "Failed to update plan.");
      }
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Subscription Plans & Quotas
          </h1>
          <p className="text-xs text-slate-500">
            Configure platform capacity boundaries, seat allocations, and feature gates for each tier.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchPlans}
          disabled={isLoading}
          className="text-xs"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-400">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-600 mb-2" />
            Loading plan definitions...
          </div>
        ) : (
          plans.map((p) => (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700 font-mono">
                    {p.code}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {p.subscriberCount} {p.subscriberCount === 1 ? "Company" : "Companies"}
                  </span>
                </div>

                <h2 className="mt-3 text-lg font-bold text-slate-900">{p.name}</h2>
                <p className="mt-1 text-xs text-slate-500 min-h-[32px]">{p.description}</p>

                {/* Quotas */}
                <div className="mt-4 space-y-2.5 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Users className="h-3.5 w-3.5 text-indigo-600" />
                      User Seats
                    </span>
                    <span className="font-bold text-slate-900">{p.maxUsers} Max</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Activity className="h-3.5 w-3.5 text-blue-600" />
                      Lead Capacity
                    </span>
                    <span className="font-bold text-slate-900">{p.maxLeads.toLocaleString()} Max</span>
                  </div>
                </div>

                {/* Features List */}
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Feature Capabilities
                  </span>
                  <div className="space-y-1 pt-1 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      {p.features?.customFields ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>Custom Fields</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.features?.export ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>CSV Export</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.features?.analytics ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>Analytics Dashboard</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.features?.auditLogs ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      )}
                      <span>Audit Logs</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(p)}
                  className="w-full text-xs font-medium"
                >
                  <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                  Edit Limits & Quotas
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Quota Dialog */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center gap-2.5 text-indigo-600">
              <Layers className="h-5 w-5" />
              <h3 className="text-base font-bold text-slate-900">
                Edit {editingPlan.name} Tier Quotas
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Changes to this plan tier will apply to all {editingPlan.subscriberCount} subscribed companies.
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Maximum User Seats
                </label>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={editMaxUsers}
                  onChange={(e) => setEditMaxUsers(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Maximum Lead Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000000}
                  value={editMaxLeads}
                  onChange={(e) => setEditMaxLeads(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="block text-xs font-medium text-slate-700 mb-2">
                  Feature Flags
                </span>
                <div className="space-y-2">
                  {[
                    { key: "customFields", label: "Custom Fields" },
                    { key: "export", label: "CSV Export" },
                    { key: "analytics", label: "Analytics Dashboard" },
                    { key: "auditLogs", label: "Audit Logs" },
                    { key: "advancedReports", label: "Advanced Reports" },
                  ].map((feat) => (
                    <label
                      key={feat.key}
                      className="flex cursor-pointer items-center justify-between text-xs text-slate-700 hover:text-slate-900"
                    >
                      <span>{feat.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(editFeatures[feat.key])}
                        onChange={(e) =>
                          setEditFeatures((prev) => ({
                            ...prev,
                            [feat.key]: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPlan(null)}
                disabled={isSaving}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSavePlan}
                disabled={isSaving}
                className="bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500"
              >
                {isSaving ? "Saving..." : "Save Quota Configuration"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
