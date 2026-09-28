"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Eye,
  ShieldAlert,
  User,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  ipAddress?: string | null;
  createdAt: string;
  actor: {
    id: string | null;
    name: string;
    email: string | null;
  };
}

export function AuditLogWorkspace() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Metadata inspector
  const [inspectLog, setInspectLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", "20");
      if (search.trim()) params.set("search", search.trim());
      if (entityType.trim()) params.set("entityType", entityType.trim());
      if (action.trim()) params.set("action", action.trim());

      const res = await fetch(`/api/v1/audit-logs?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to load audit logs");
      }

      setLogs(json.data || []);
      if (json.pagination) {
        setTotalPages(json.pagination.totalPages || 1);
        setTotalCount(json.pagination.total || 0);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch audit records");
    } finally {
      setLoading(false);
    }
  }, [page, search, entityType, action]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const getActionColor = (act: string) => {
    if (act.includes("DELETE") || act.includes("REVOKE") || act.includes("DEACTIVATED")) {
      return "bg-destructive/10 text-destructive border-destructive/20";
    }
    if (act.includes("CREATE") || act.includes("INVITE") || act.includes("ACTIVATED")) {
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    }
    if (act.includes("UPDATE") || act.includes("RESET")) {
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    }
    return "bg-secondary text-secondary-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actor, ID, or action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All Entity Types</option>
              <option value="USER">User</option>
              <option value="TEAM">Team</option>
              <option value="ROLE">Role</option>
              <option value="INVITATION">Invitation</option>
              <option value="SESSION">Session</option>
              <option value="COMPANY">Company</option>
              <option value="LEAD">Lead</option>
              <option value="CUSTOM_FIELD">Custom Field</option>
            </select>

            <Input
              placeholder="Filter by action (e.g. USER_INVITED)"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />

            <div className="flex items-center gap-2">
              <Button type="submit" className="flex-1">
                Filter
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setEntityType("");
                  setAction("");
                  setPage(1);
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Compliance / Immutability Banner */}
      <div className="p-3 bg-muted/60 border rounded-lg flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span>
            Universal CRM Audit Trail: Immutable, tenant-isolated ledger for compliance and operational transparency.
          </span>
        </div>
        <span>Total Records: {totalCount}</span>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Actor</th>
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium">Entity</th>
                  <th className="py-3 px-4 font-medium">IP Address</th>
                  <th className="py-3 px-4 font-medium text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading audit records...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No audit log records match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                            {log.actor.name ? log.actor.name.charAt(0).toUpperCase() : "S"}
                          </div>
                          <div className="text-xs">
                            <span className="font-medium block leading-tight">{log.actor.name}</span>
                            {log.actor.email && (
                              <span className="text-[11px] text-muted-foreground block">
                                {log.actor.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={`text-xs font-mono font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="font-semibold text-foreground">{log.entityType}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {log.entityId}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                        {log.ipAddress || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectLog(log)}
                          className="h-7 text-xs gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} total entries)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="gap-1 text-xs"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Inspection Modal */}
      <Dialog open={Boolean(inspectLog)} onOpenChange={(open) => !open && setInspectLog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Audit Log Record Inspector
            </DialogTitle>
            <DialogDescription>
              Record ID: <span className="font-mono text-xs">{inspectLog?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {inspectLog && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted rounded-lg">
                <div>
                  <span className="text-muted-foreground block">Action</span>
                  <span className="font-semibold text-sm">{inspectLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Timestamp</span>
                  <span className="font-medium">{new Date(inspectLog.createdAt).toISOString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Entity Target</span>
                  <span className="font-mono">
                    {inspectLog.entityType} ({inspectLog.entityId})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Origin IP</span>
                  <span className="font-mono">{inspectLog.ipAddress || "Not recorded"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block">Actor</span>
                  <span className="font-medium">
                    {inspectLog.actor.name} {inspectLog.actor.email ? `(${inspectLog.actor.email})` : ""}
                  </span>
                </div>
              </div>

              <div>
                <span className="font-semibold text-muted-foreground uppercase text-[11px] block mb-1">
                  Metadata Payload (JSON)
                </span>
                <pre className="p-3 bg-zinc-950 text-zinc-100 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(inspectLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
