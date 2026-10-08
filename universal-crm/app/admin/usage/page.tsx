"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  HardDrive,
  Building2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Search,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  FolderTree,
  Database,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/lib/utils/format-bytes";

interface StorageCategory {
  usedBytes: number;
  fileCount: number;
}

interface CompanyStorageItem {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  plan: {
    id: string | null;
    name: string;
    code: string;
  };
  storage: {
    usedBytes: number;
    limitBytes: number | null;
    availableBytes: number | null;
    usagePercentage: number | null;
    fileCount: number;
    status: "HEALTHY" | "NEAR_LIMIT" | "CRITICAL_90" | "OVER_LIMIT" | "LIMIT_NOT_CONFIGURED";
    categories: Record<string, StorageCategory>;
  };
  userCount: number;
  maxUsers: number;
  leadCount: number;
  maxLeads: number;
  createdAt: string;
  updatedAt: string;
}

interface PlatformTelemetry {
  platform: {
    totalOrganizations: number;
    activeOrganizations: number;
    suspendedOrganizations: number;
    totalStorageUsedBytes: number;
    totalStorageLimitBytes: number | null;
    totalFiles: number;
    organizationsNearLimit: number;
    organizationsOverLimit: number;
    storageProvider: "local" | "r2";
    generatedAt: string;
  };
  organizations: CompanyStorageItem[];
  generatedAt: string;
}

type SortField = "usedBytes" | "usagePercentage" | "name" | "fileCount";

export default function StorageUsageDashboardPage() {
  const [data, setData] = useState<PlatformTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortField>("usedBytes");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedCompanyBreakdown, setSelectedCompanyBreakdown] = useState<CompanyStorageItem | null>(null);

  const loadUsage = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/usage");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error?.message || "Failed to load storage telemetry.");
      }
    } catch {
      setError("An unexpected network error occurred while aggregating storage metrics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsage();
  }, []);

  const filteredOrganizations = useMemo(() => {
    if (!data?.organizations) return [];

    return data.organizations
      .filter((org) => {
        const matchesSearch =
          org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          org.slug.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        if (statusFilter === "ALL") return true;
        if (statusFilter === "OVER_LIMIT") return org.storage.status === "OVER_LIMIT";
        if (statusFilter === "NEAR_LIMIT")
          return org.storage.status === "NEAR_LIMIT" || org.storage.status === "CRITICAL_90";
        if (statusFilter === "HEALTHY") return org.storage.status === "HEALTHY";
        if (statusFilter === "UNCONFIGURED") return org.storage.status === "LIMIT_NOT_CONFIGURED";

        return true;
      })
      .sort((a, b) => {
        let valA: number | string = 0;
        let valB: number | string = 0;

        if (sortBy === "usedBytes") {
          valA = a.storage.usedBytes;
          valB = b.storage.usedBytes;
        } else if (sortBy === "usagePercentage") {
          valA = a.storage.usagePercentage ?? -1;
          valB = b.storage.usagePercentage ?? -1;
        } else if (sortBy === "fileCount") {
          valA = a.storage.fileCount;
          valB = b.storage.fileCount;
        } else if (sortBy === "name") {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        }

        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        return sortOrder === "asc" ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      });
  }, [data, searchQuery, statusFilter, sortBy, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const platform = data?.platform;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Usage & Storage Telemetry
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              DODO CRM Fleet
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-tenant storage aggregation, capacity limits, and quota health.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {data?.generatedAt && (
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              Updated {new Date(data.generatedAt).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsage}
            disabled={isLoading}
            className="h-8 text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/80 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadUsage} className="h-7 text-xs bg-white text-rose-700 border-rose-200">
            Retry
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Storage Used */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Total Storage Used</CardTitle>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {isLoading ? (
                <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
              ) : (
                formatBytes(platform?.totalStorageUsedBytes ?? 0)
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{platform?.totalFiles?.toLocaleString() ?? 0} persisted files</span>
              <span className="font-semibold text-slate-600 uppercase text-[10px]">
                {platform?.storageProvider === "r2" ? "Cloudflare R2" : "Local Storage"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Total Organizations */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Total Organizations</CardTitle>
            <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-slate-700" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {isLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded" />
              ) : (
                platform?.totalOrganizations ?? 0
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="text-emerald-700 font-semibold">{platform?.activeOrganizations ?? 0} active</span>
              {Boolean(platform?.suspendedOrganizations) && (
                <span className="text-rose-600 font-semibold">• {platform?.suspendedOrganizations} suspended</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Configured Storage Limit */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Configured Capacity</CardTitle>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Database className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {isLoading ? (
                <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
              ) : platform?.totalStorageLimitBytes !== null && platform?.totalStorageLimitBytes !== undefined ? (
                formatBytes(platform.totalStorageLimitBytes)
              ) : (
                <span className="text-base text-slate-500 font-medium font-sans">Unmetered Fleet</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {platform?.totalStorageLimitBytes ? "Sum of configured tenant limits" : "Plan storage limits unconfigured"}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Quota Threshold Health */}
        <Card className="border border-slate-200 bg-white shadow-xs">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Capacity Alerts</CardTitle>
            <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-1">
            <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {isLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded" />
              ) : (
                (platform?.organizationsNearLimit ?? 0) + (platform?.organizationsOverLimit ?? 0)
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {platform?.organizationsOverLimit ? (
                <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                  {platform.organizationsOverLimit} Over Limit
                </span>
              ) : null}
              {platform?.organizationsNearLimit ? (
                <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  {platform.organizationsNearLimit} Near Limit
                </span>
              ) : null}
              {!platform?.organizationsNearLimit && !platform?.organizationsOverLimit && (
                <span className="text-emerald-700 font-medium">All organizations healthy</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Section */}
      <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Organization Storage Directory ({filteredOrganizations.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Measured filesystem and object storage consumption per tenant.
            </CardDescription>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search organization..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="HEALTHY">Healthy</option>
              <option value="NEAR_LIMIT">Near Limit (≥80%)</option>
              <option value="OVER_LIMIT">Over Limit (≥100%)</option>
              <option value="UNCONFIGURED">Unmetered</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th
                    className="px-4 py-3 cursor-pointer select-none hover:text-slate-900"
                    onClick={() => toggleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Organization
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Plan</th>
                  <th
                    className="px-4 py-3 cursor-pointer select-none hover:text-slate-900"
                    onClick={() => toggleSort("usedBytes")}
                  >
                    <div className="flex items-center gap-1">
                      Storage Used
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Limit</th>
                  <th
                    className="px-4 py-3 cursor-pointer select-none hover:text-slate-900 w-44"
                    onClick={() => toggleSort("usagePercentage")}
                  >
                    <div className="flex items-center gap-1">
                      Utilization
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3">User Seats</th>
                  <th className="px-4 py-3">Leads</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center text-xs text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
                      Aggregating tenant storage telemetry...
                    </td>
                  </tr>
                ) : filteredOrganizations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                      No organizations matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrganizations.map((c) => {
                    const hasLimit = c.storage.limitBytes !== null && c.storage.limitBytes > 0;
                    const pct = c.storage.usagePercentage;
                    const hasCategories = Object.keys(c.storage.categories || {}).length > 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Organization */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{c.slug}</div>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {c.plan?.name || "Starter"}
                          </span>
                        </td>

                        {/* Used Storage */}
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-slate-900">
                            {formatBytes(c.storage.usedBytes)}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span>{c.storage.fileCount} {c.storage.fileCount === 1 ? "file" : "files"}</span>
                            {hasCategories && (
                              <button
                                onClick={() => setSelectedCompanyBreakdown(c)}
                                className="text-indigo-600 hover:text-indigo-800 underline font-medium ml-1 cursor-pointer"
                                title="View storage breakdown"
                              >
                                breakdown
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Limit */}
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {hasLimit ? (
                            formatBytes(c.storage.limitBytes)
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unmetered</span>
                          )}
                        </td>

                        {/* Utilization Bar */}
                        <td className="px-4 py-3">
                          {hasLimit && pct !== null ? (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-mono">
                                <span className="text-slate-500">
                                  {pct}%
                                </span>
                                {c.storage.status === "OVER_LIMIT" && (
                                  <span className="text-[10px] text-rose-700 font-bold">Exceeded</span>
                                )}
                              </div>
                              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    c.storage.status === "OVER_LIMIT"
                                      ? "bg-rose-600"
                                      : c.storage.status === "CRITICAL_90"
                                      ? "bg-rose-500"
                                      : c.storage.status === "NEAR_LIMIT"
                                      ? "bg-amber-500"
                                      : "bg-indigo-600"
                                  }`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {c.storage.usedBytes > 0 ? "Metered (No Cap)" : "No storage cap"}
                            </span>
                          )}
                        </td>

                        {/* User Seats */}
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {c.userCount} / {c.maxUsers}
                        </td>

                        {/* Leads */}
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {c.leadCount.toLocaleString()} / {c.maxLeads.toLocaleString()}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.storage.status === "OVER_LIMIT"
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : c.storage.status === "CRITICAL_90"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : c.storage.status === "NEAR_LIMIT"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : c.storage.status === "HEALTHY"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {c.storage.status === "LIMIT_NOT_CONFIGURED"
                              ? "Unmetered"
                              : c.storage.status === "CRITICAL_90"
                              ? "Critical"
                              : c.storage.status.replace("_", " ")}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/companies/${c.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600 hover:text-indigo-800">
                              Inspect <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Storage Breakdown Modal */}
      {selectedCompanyBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Storage Breakdown: {selectedCompanyBreakdown.name}
                </h3>
              </div>
              <span className="font-mono font-bold text-xs text-indigo-700">
                {formatBytes(selectedCompanyBreakdown.storage.usedBytes)}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Breakdown of persisted files by folder namespace for organization{" "}
              <strong className="text-slate-800 font-mono">{selectedCompanyBreakdown.slug}</strong>:
            </p>

            <div className="space-y-2">
              {Object.entries(selectedCompanyBreakdown.storage.categories || {}).length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No subfolder breakdown available.
                </div>
              ) : (
                Object.entries(selectedCompanyBreakdown.storage.categories).map(([category, stats]) => (
                  <div
                    key={category}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 capitalize block">{category}</span>
                      <span className="text-[10px] text-slate-400">
                        {stats.fileCount} {stats.fileCount === 1 ? "file" : "files"}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-800">
                      {formatBytes(stats.usedBytes)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCompanyBreakdown(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
