"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScrollText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlatformAuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  superAdmin: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<PlatformAuditLogItem[]>([]);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Log Drawer/Modal State
  const [selectedLog, setSelectedLog] = useState<PlatformAuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (actionFilter) params.set("action", actionFilter);

      const res = await fetch(`/api/v1/admin/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setLogs(json.data);
        setPagination(json.pagination);
      }
    } catch {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  }, [page, search, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Platform Audit Trail
          </h1>
          <p className="text-xs text-slate-500">
            Immutable, append-only security log of all cross-tenant platform administrative actions.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={isLoading}
          className="text-xs"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, target entity, or operator..."
            className="w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
          />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="SUPER_ADMIN_LOGIN">SUPER_ADMIN_LOGIN</option>
            <option value="SUPER_ADMIN_LOGOUT">SUPER_ADMIN_LOGOUT</option>
            <option value="COMPANY_CREATED">COMPANY_CREATED</option>
            <option value="COMPANY_SUSPENDED">COMPANY_SUSPENDED</option>
            <option value="COMPANY_REACTIVATED">COMPANY_REACTIVATED</option>
            <option value="PLAN_UPDATED">PLAN_UPDATED</option>
            <option value="PLAN_ASSIGNED">PLAN_ASSIGNED</option>
            <option value="SUPER_ADMIN_PASSWORD_CHANGED">SUPER_ADMIN_PASSWORD_CHANGED</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">Entity ID</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {log.entityType}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {log.entityId ? log.entityId.slice(0, 12) + "..." : "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.superAdmin?.email ?? "System"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {log.ipAddress || "—"}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                      >
                        <Info className="mr-1 h-3.5 w-3.5" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ScrollText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    No platform audit events found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} events)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPreviousPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Detail Dialog */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedLog.action} Details
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Entity</span>
                  <span className="font-semibold text-slate-800">{selectedLog.entityType} ({selectedLog.entityId || "N/A"})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Operator</span>
                  <span className="font-semibold text-slate-800">{selectedLog.superAdmin?.email ?? "System"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">IP Address</span>
                  <span className="font-mono text-slate-800">{selectedLog.ipAddress || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Timestamp</span>
                  <span className="text-slate-800">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="block font-semibold text-slate-700 mb-1">Metadata</span>
                  <pre className="rounded-lg bg-slate-900 p-3 text-[11px] text-emerald-400 overflow-x-auto font-mono">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.beforeState && Object.keys(selectedLog.beforeState).length > 0 && (
                <div>
                  <span className="block font-semibold text-slate-700 mb-1">Before State</span>
                  <pre className="rounded-lg bg-slate-900 p-3 text-[11px] text-amber-400 overflow-x-auto font-mono">
                    {JSON.stringify(selectedLog.beforeState, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterState && Object.keys(selectedLog.afterState).length > 0 && (
                <div>
                  <span className="block font-semibold text-slate-700 mb-1">After State</span>
                  <pre className="rounded-lg bg-slate-900 p-3 text-[11px] text-sky-400 overflow-x-auto font-mono">
                    {JSON.stringify(selectedLog.afterState, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
