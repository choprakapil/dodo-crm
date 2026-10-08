"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  PauseCircle,
  PlayCircle,
  Layers,
  Trash2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBulkSelection, BulkCheckbox, BulkActionToolbar, BulkAction, BulkActionResult } from "@/components/bulk";

interface CompanyItem {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  email: string | null;
  timezone: string;
  currency: string;
  plan: {
    id: string;
    name: string;
    code: string;
    maxUsers: number;
    maxLeads: number;
  } | null;
  userCount: number;
  leadCount: number;
  createdAt: string;
}

interface CompaniesResponse {
  data: CompanyItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [pagination, setPagination] = useState<CompaniesResponse["pagination"] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Universal Bulk Selection Hook
  const {
    selectedIds,
    selectedItems,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection<CompanyItem>({
    items: companies,
  });

  const fetchCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "15");
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (planFilter) params.set("planTier", planFilter);

      const res = await fetch(`/api/v1/admin/companies?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setCompanies(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // Error handling
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    clearSelection();
    fetchCompanies();
  };

  // Declarative Bulk Actions
  const bulkActions: BulkAction<CompanyItem>[] = useMemo(() => [
    {
      id: "suspend",
      label: "Suspend",
      icon: PauseCircle,
      variant: "warning",
      requiresConfirmation: true,
      confirmType: "reason",
      confirmTitle: "Suspend Selected Organizations",
      confirmDescription: "All active user sessions for these tenants will be revoked immediately.",
      confirmPlaceholder: "e.g. Account billing overdue / Administrative review",
      onExecute: async (ids, extraData) => {
        const res = await fetch("/api/v1/admin/companies/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SUSPEND",
            companyIds: ids,
            reason: extraData?.reason,
          }),
        });
        const data = await res.json();
        return data;
      },
    },
    {
      id: "reactivate",
      label: "Reactivate",
      icon: PlayCircle,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Reactivate Selected Organizations",
      confirmDescription: "Restores active operational status so tenant users can sign in immediately.",
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/companies/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "REACTIVATE",
            companyIds: ids,
          }),
        });
        const data = await res.json();
        return data;
      },
    },
    {
      id: "plan",
      label: "Change Plan",
      icon: Layers,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "select",
      confirmTitle: "Change Subscription Tier",
      confirmDescription: "Reassign selected organizations to a new quota and feature tier.",
      selectLabel: "Target Subscription Plan",
      selectOptions: [
        { label: "FREE", value: "FREE", description: "5 Users / 500 Leads max quota" },
        { label: "STARTER", value: "STARTER", description: "10 Users / 2,500 Leads max quota" },
        { label: "PROFESSIONAL", value: "PROFESSIONAL", description: "25 Users / 10,000 Leads max quota" },
        { label: "ENTERPRISE", value: "ENTERPRISE", description: "100 Users / 100,000 Leads max quota" },
      ],
      onExecute: async (ids, extraData) => {
        const res = await fetch("/api/v1/admin/companies/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CHANGE_PLAN",
            companyIds: ids,
            planTier: extraData?.selectedValue || "STARTER",
          }),
        });
        const data = await res.json();
        return data;
      },
    },
    {
      id: "export",
      label: "Export CSV",
      icon: Download,
      variant: "outline",
      onExecute: async (ids) => {
        const headers = ["ID", "Company Name", "Slug", "Status", "Plan Tier", "Max Users", "Max Leads", "Active Users", "Total Leads", "Created Date"];
        const rows = selectedItems.map((c) => [
          `"${c.id}"`,
          `"${c.name.replace(/"/g, '""')}"`,
          `"${c.slug}"`,
          `"${c.status}"`,
          `"${c.plan?.name || "Starter"}"`,
          c.plan?.maxUsers ?? "",
          c.plan?.maxLeads ?? "",
          c.userCount,
          c.leadCount,
          `"${new Date(c.createdAt).toISOString()}"`,
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `dodo_fleet_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return {
          success: true,
          total: ids.length,
          succeededCount: ids.length,
          failedCount: 0,
        };
      },
    },
    {
      id: "purge",
      label: `Purge (${selectedCount})`,
      icon: Trash2,
      variant: "destructive",
      destructive: true,
      requiresConfirmation: true,
      confirmType: "typed_delete",
      confirmTitle: "Purge Selected Organizations",
      confirmDescription: "Permanently cascade-deletes all associated tenant users, leads, activities, and audit logs. This cannot be undone.",
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/companies/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "PURGE",
            companyIds: ids,
          }),
        });
        const data = await res.json();
        return data;
      },
    },
  ], [selectedCount, selectedItems]);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tenant Fleet
          </h1>
          <p className="text-xs text-slate-500">
            Manage provisioned organizations, plan limits, operational state, and account status.
          </p>
        </div>

        <Link href="/admin/companies/new">
          <Button size="sm" className="bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500 shadow-sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Provision Company
          </Button>
        </Link>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company name, slug, or admin email..."
            className="w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
              clearSelection();
            }}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>

          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setPage(1);
              clearSelection();
            }}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Plans</option>
            <option value="FREE">Free</option>
            <option value="STARTER">Starter</option>
            <option value="PROFESSIONAL">Professional</option>
            <option value="ENTERPRISE">Enterprise</option>
          </select>
        </div>
      </div>

      {/* Companies Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4 w-10">
                  <BulkCheckbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={toggleSelectAll}
                    ariaLabel="Select all visible companies"
                  />
                </th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Plan Tier</th>
                <th className="py-3 px-4 text-center">Users</th>
                <th className="py-3 px-4 text-center">Leads</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading organizations...
                  </td>
                </tr>
              ) : companies.length > 0 ? (
                companies.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isSelected ? "bg-indigo-50/60 hover:bg-indigo-50/80" : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <BulkCheckbox
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                          ariaLabel={`Select ${c.name}`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-700 text-xs">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">{c.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{c.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            c.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {c.plan?.name ?? "Starter"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-800">
                        {c.userCount} {c.plan ? `/ ${c.plan.maxUsers}` : ""}
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-slate-800">
                        {c.leadCount.toLocaleString()} {c.plan ? `/ ${c.plan.maxLeads.toLocaleString()}` : ""}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/admin/companies/${c.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs font-medium">
                            Inspect
                            <ExternalLink className="ml-1.5 h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <Building2 className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    No organizations matched your query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
            <span>
              Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total organizations)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPreviousPage}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  clearSelection();
                }}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => {
                  setPage((p) => p + 1);
                  clearSelection();
                }}
                className="h-7 px-2"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Universal Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        selectedIds={Array.from(selectedIds)}
        actions={bulkActions}
        onClearSelection={clearSelection}
        onActionComplete={fetchCompanies}
        entityName="organizations"
        totalMatchingCount={pagination?.total}
      />
    </div>
  );
}
