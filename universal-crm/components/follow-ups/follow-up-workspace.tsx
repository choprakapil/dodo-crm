"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Clock,
  AlertTriangle,
  Search,
  User,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Calendar,
  History as HistoryIcon,
  RefreshCw,
} from "lucide-react";

interface FollowUpItem {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING" | "OVERDUE" | "COMPLETED" | "CANCELLED";
  completedAt: string | null;
  lead: {
    id: string;
    name: string;
    company: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  assignedUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  creator: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface HistoryEvent {
  id: string;
  eventType: string;
  previousDueAt: string | null;
  newDueAt: string | null;
  reason: string | null;
  createdAt: string;
  performedBy?: { name: string } | null;
  disposition?: { name: string; color: string | null } | null;
}

interface FollowUpWorkspaceProps {
  initialItems: FollowUpItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  currentDueFilter: string;
  currentSearch?: string;
}

export function FollowUpWorkspace({
  initialItems,
  pagination,
  currentDueFilter,
  currentSearch = "",
}: FollowUpWorkspaceProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(currentSearch);
  const [activeTab, setActiveTab] = useState(currentDueFilter);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingOverdue, setSyncingOverdue] = useState(false);

  // Reschedule Dialog state
  const [rescheduleTask, setRescheduleTask] = useState<FollowUpItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("10:00");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  // History Dialog state
  const [historyTask, setHistoryTask] = useState<FollowUpItem | null>(null);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const filterTabs = [
    { key: "today", label: "Today" },
    { key: "overdue", label: "Overdue" },
    { key: "upcoming", label: "Upcoming" },
    { key: "all", label: "All Follow-ups" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  function applyFilter(dueFilter: string, searchQuery?: string, page = 1) {
    const params = new URLSearchParams();
    if (dueFilter && dueFilter !== "all") params.set("dueFilter", dueFilter);
    const q = searchQuery !== undefined ? searchQuery : search;
    if (q) params.set("search", q);
    if (page > 1) params.set("page", String(page));

    startTransition(() => {
      router.push(`/app/follow-ups?${params.toString()}`);
    });
  }

  function handleTabChange(tabKey: string) {
    setActiveTab(tabKey);
    applyFilter(tabKey, search, 1);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilter(activeTab, search, 1);
  }

  async function handleComplete(id: string) {
    setCompletingId(id);
    try {
      const res = await fetch(`/api/v1/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!res.ok) throw new Error("Failed to complete follow-up");
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error completing task");
    } finally {
      setCompletingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this follow-up?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/follow-ups/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete follow-up");
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting task");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSyncOverdue() {
    setSyncingOverdue(true);
    try {
      const res = await fetch("/api/v1/follow-ups/sync-overdue", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        startTransition(() => router.refresh());
      }
    } catch (err) {
      console.error("Overdue sync failed", err);
    } finally {
      setSyncingOverdue(false);
    }
  }

  function openReschedule(task: FollowUpItem) {
    setRescheduleTask(task);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setRescheduleDate(tomorrow.toISOString().split("T")[0]);
    setRescheduleTime("10:00");
    setRescheduleReason("");
  }

  async function handleRescheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rescheduleTask || !rescheduleDate) return;

    setRescheduling(true);
    try {
      const combined = new Date(`${rescheduleDate}T${rescheduleTime || "10:00"}:00`);
      const res = await fetch(`/api/v1/follow-ups/${rescheduleTask.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueAt: combined.toISOString(),
          reason: rescheduleReason.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to reschedule follow-up");
      }
      setRescheduleTask(null);
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error rescheduling task");
    } finally {
      setRescheduling(false);
    }
  }

  async function openHistory(task: FollowUpItem) {
    setHistoryTask(task);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/v1/follow-ups/${task.id}/history`);
      const json = await res.json();
      if (res.ok && json.success) {
        setHistoryEvents(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case "URGENT":
        return <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px]">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-indigo-500/15 text-indigo-400 border-indigo-500/30 text-[10px]">Medium</Badge>;
      case "LOW":
        return <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">Low</Badge>;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">Completed</Badge>;
      case "CANCELLED":
        return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">Cancelled</Badge>;
      case "OVERDUE":
        return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]">Overdue</Badge>;
      case "PENDING":
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px]">Pending</Badge>;
    }
  }

  function formatDateTime(val: string | null) {
    if (!val) return "No due date";
    const d = new Date(val);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const now = new Date();

  return (
    <div className="space-y-4">
      {/* Search and Tabs Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === tab.key
                  ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Overdue Sync */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncOverdue}
            disabled={syncingOverdue}
            className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs h-8 px-2.5 gap-1.5"
            title="Check and transition past-due pending tasks to overdue"
          >
            <RefreshCw className={`h-3 w-3 ${syncingOverdue ? "animate-spin" : ""}`} />
            <span>Sync Overdue</span>
          </Button>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search follow-ups or leads..."
                className="pl-8 bg-slate-900/80 border-slate-800 text-xs h-8 text-white w-56 focus-visible:ring-indigo-500"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs h-8 px-3"
            >
              Search
            </Button>
          </form>
        </div>
      </div>

      {/* Follow-up Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Follow-up Task</th>
                <th className="py-3 px-4">Lead / Customer</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {initialItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-slate-600 opacity-60" />
                    <p className="text-sm font-medium text-slate-400">No follow-ups found</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      No follow-ups match your current filter criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                initialItems.map((item) => {
                  const isOverdue =
                    (item.status === "PENDING" || item.status === "OVERDUE") &&
                    item.dueAt &&
                    new Date(item.dueAt) < now;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/30 transition group"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{item.title}</div>
                        {item.description && (
                          <div className="text-slate-400 text-[11px] line-clamp-1 mt-0.5">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.lead ? (
                          <Link
                            href={`/app/leads/${item.lead.id}`}
                            className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            {item.lead.name}
                          </Link>
                        ) : (
                          <span className="text-slate-500 italic">No Lead Linked</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.assignedUser ? (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <User className="h-3 w-3 text-slate-500" />
                            <span>{item.assignedUser.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center gap-1.5">
                          {isOverdue ? (
                            <span className="flex items-center gap-1 text-rose-400 font-semibold">
                              <AlertTriangle className="h-3 w-3" />
                              {formatDateTime(item.dueAt)}
                            </span>
                          ) : (
                            <span className="text-slate-300 flex items-center gap-1">
                              <Clock className="h-3 w-3 text-slate-500" />
                              {formatDateTime(item.dueAt)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getPriorityBadge(item.priority)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* History Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openHistory(item)}
                            className="text-slate-400 hover:text-slate-200 text-[11px] h-7 px-1.5"
                            title="View Follow-up Lifecycle History"
                          >
                            <HistoryIcon className="h-3.5 w-3.5" />
                          </Button>

                          {/* Reschedule Button */}
                          {(item.status === "PENDING" || item.status === "OVERDUE") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReschedule(item)}
                              className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[11px] h-7 px-2 gap-1"
                              title="Reschedule Follow-up"
                            >
                              <Calendar className="h-3 w-3" />
                              <span>Reschedule</span>
                            </Button>
                          )}

                          {/* Complete Button */}
                          {(item.status === "PENDING" || item.status === "OVERDUE") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleComplete(item.id)}
                              disabled={completingId === item.id}
                              className="border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] h-7 px-2 gap-1"
                            >
                              {completingId === item.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              <span>Complete</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="text-slate-500 hover:text-rose-400 text-[11px] h-7 px-1.5"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400">
            <div>
              Showing{" "}
              <span className="font-medium text-white">
                {(pagination.page - 1) * pagination.pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-white">
                {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}
              </span>{" "}
              of <span className="font-medium text-white">{pagination.totalCount}</span> follow-ups
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => applyFilter(activeTab, search, pagination.page - 1)}
                className="h-7 w-7 p-0 border-slate-800 bg-slate-900 text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 font-mono text-[11px]">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => applyFilter(activeTab, search, pagination.page + 1)}
                className="h-7 w-7 p-0 border-slate-800 bg-slate-900 text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      <Dialog open={!!rescheduleTask} onOpenChange={(open) => !open && setRescheduleTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule Follow-Up</DialogTitle>
            <DialogDescription>
              Update the scheduled date/time for &quot;{rescheduleTask?.title}&quot;. Status will reset to PENDING with an immutable history audit trail.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRescheduleSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="resched-date">New Date *</Label>
                <Input
                  id="resched-date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="resched-time">New Time</Label>
                <Input
                  id="resched-time"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="resched-reason">Reason for Rescheduling</Label>
              <Input
                id="resched-reason"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="e.g. Customer requested callback tomorrow morning"
              />
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRescheduleTask(null)}
                disabled={rescheduling}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={rescheduling}>
                {rescheduling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Reschedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lifecycle History Modal */}
      <Dialog open={!!historyTask} onOpenChange={(open) => !open && setHistoryTask(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5 text-primary" />
              Follow-up Lifecycle History
            </DialogTitle>
            <DialogDescription>
              Immutable transition log for &quot;{historyTask?.title}&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {loadingHistory ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : historyEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No lifecycle events recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {historyEvents.map((ev) => (
                  <div key={ev.id} className="p-3 border rounded-lg bg-card/50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {ev.eventType}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {ev.reason && (
                      <div className="text-foreground font-medium">{ev.reason}</div>
                    )}

                    {ev.newDueAt && (
                      <div className="text-muted-foreground font-mono text-[11px]">
                        Due: {new Date(ev.newDueAt).toLocaleString()}
                        {ev.previousDueAt && (
                          <span className="text-slate-500 line-through ml-2">
                            (was {new Date(ev.previousDueAt).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-muted/50">
                      <span>By: {ev.performedBy?.name || "System"}</span>
                      {ev.disposition && (
                        <span className="font-medium text-primary">
                          Disposition: {ev.disposition.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
