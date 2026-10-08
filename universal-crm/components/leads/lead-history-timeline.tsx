"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  User,
  ArrowRight,
  Activity as ActivityIcon,
  Phone,
  MessageSquare,
  Mail,
  FileText,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  PlusCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";

interface StatusHistoryItem {
  id: string;
  changedAt: string | Date;
  fromStatus: { id: string; name: string; color: string } | null;
  toStatus: { id: string; name: string; color: string } | null;
  changedBy: { id: string; name: string; email: string } | null;
}

interface AssignmentHistoryItem {
  id: string;
  assignedAt: string | Date;
  fromUser: { id: string; name: string; email: string } | null;
  toUser: { id: string; name: string; email: string } | null;
  assignedBy: { id: string; name: string; email: string } | null;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  createdAt: string | Date;
  metadata?: unknown;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface LeadHistoryTimelineProps {
  statusHistories: StatusHistoryItem[];
  assignmentHistories: AssignmentHistoryItem[];
  activities: ActivityItem[];
}

export function LeadHistoryTimeline({
  statusHistories,
  assignmentHistories,
  activities,
}: LeadHistoryTimelineProps) {
  const [activeTab, setActiveTab] = useState<
    "all" | "calls" | "notes" | "followups" | "status" | "assignment"
  >("all");

  function formatDate(d: string | Date) {
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getActivityVisual(type: string) {
    switch (type) {
      case "CALL":
        return {
          icon: Phone,
          color: "text-emerald-400",
          bg: "bg-emerald-500/10 border-emerald-500/30",
          label: "Call Logged",
        };
      case "WHATSAPP":
        return {
          icon: MessageSquare,
          color: "text-green-400",
          bg: "bg-green-500/10 border-green-500/30",
          label: "WhatsApp",
        };
      case "EMAIL":
        return {
          icon: Mail,
          color: "text-sky-400",
          bg: "bg-sky-500/10 border-sky-500/30",
          label: "Email",
        };
      case "NOTE":
      case "NOTE_ADDED":
        return {
          icon: FileText,
          color: "text-amber-400",
          bg: "bg-amber-500/10 border-amber-500/30",
          label: "Note",
        };
      case "MEETING":
        return {
          icon: Calendar,
          color: "text-violet-400",
          bg: "bg-violet-500/10 border-violet-500/30",
          label: "Meeting",
        };
      case "TASK_CREATED":
        return {
          icon: Clock,
          color: "text-blue-400",
          bg: "bg-blue-500/10 border-blue-500/30",
          label: "Follow-up Scheduled",
        };
      case "TASK_COMPLETED":
        return {
          icon: CheckCircle2,
          color: "text-emerald-400",
          bg: "bg-emerald-500/10 border-emerald-500/30",
          label: "Follow-up Completed",
        };
      case "TASK_CANCELLED":
        return {
          icon: XCircle,
          color: "text-rose-400",
          bg: "bg-rose-500/10 border-rose-500/30",
          label: "Follow-up Cancelled",
        };
      case "TASK_DELETED":
        return {
          icon: Trash2,
          color: "text-slate-400",
          bg: "bg-slate-800 border-slate-700",
          label: "Follow-up Deleted",
        };
      case "STATUS_CHANGED":
        return {
          icon: RefreshCw,
          color: "text-indigo-400",
          bg: "bg-indigo-500/10 border-indigo-500/30",
          label: "Status Changed",
        };
      case "ASSIGNED":
      case "REASSIGNED":
        return {
          icon: User,
          color: "text-purple-400",
          bg: "bg-purple-500/10 border-purple-500/30",
          label: "Assignment",
        };
      case "LEAD_CREATED":
        return {
          icon: PlusCircle,
          color: "text-cyan-400",
          bg: "bg-cyan-500/10 border-cyan-500/30",
          label: "Lead Created",
        };
      default:
        return {
          icon: ActivityIcon,
          color: "text-slate-400",
          bg: "bg-slate-800 border-slate-700",
          label: type,
        };
    }
  }

  const callsCount = activities.filter((a) => a.type === "CALL").length;
  const notesCount = activities.filter((a) => a.type === "NOTE" || a.type === "NOTE_ADDED").length;
  const followupsCount = activities.filter((a) =>
    ["TASK_CREATED", "TASK_COMPLETED", "TASK_RESCHEDULED", "FOLLOW_UP_SCHEDULED"].includes(a.type)
  ).length;

  const filteredActivities = activities.filter((act) => {
    if (activeTab === "all") return true;
    if (activeTab === "calls") return act.type === "CALL";
    if (activeTab === "notes") return act.type === "NOTE" || act.type === "NOTE_ADDED";
    if (activeTab === "followups") {
      return ["TASK_CREATED", "TASK_COMPLETED", "TASK_RESCHEDULED", "FOLLOW_UP_SCHEDULED"].includes(
        act.type
      );
    }
    return false;
  });

  return (
    <div className="space-y-4">
      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2.5">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            activeTab === "all"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-semibold"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          All ({activities.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("calls")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            activeTab === "calls"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-semibold"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Calls ({callsCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            activeTab === "notes"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-semibold"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Notes ({notesCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("followups")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            activeTab === "followups"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-semibold"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Follow-ups ({followupsCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("status")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            activeTab === "status"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-semibold"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Status ({statusHistories.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("assignment")}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            activeTab === "assignment"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-semibold"
              : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Assignment ({assignmentHistories.length})
        </button>
      </div>

      {/* Content based on tab */}
      {(activeTab === "all" ||
        activeTab === "calls" ||
        activeTab === "notes" ||
        activeTab === "followups") && (
        <div className="space-y-3">
          {filteredActivities.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">
              {activeTab === "calls"
                ? "No call outcomes logged yet."
                : activeTab === "notes"
                ? "No notes added yet."
                : activeTab === "followups"
                ? "No scheduled follow-up tasks recorded yet."
                : "No activities recorded yet."}
            </p>
          ) : (
            filteredActivities.map((act) => {
              const visual = getActivityVisual(act.type);
              const Icon = visual.icon;
              return (
                <div
                  key={act.id}
                  className="flex items-start space-x-3 p-3.5 rounded-xl border border-slate-200/90 bg-white text-xs transition hover:border-slate-300 shadow-2xs"
                >
                  <div
                    className={`h-7 w-7 rounded-lg ${visual.bg} border flex items-center justify-center ${visual.color} shrink-0 mt-0.5`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{visual.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {formatDate(act.createdAt)}
                      </span>
                    </div>
                    <p className="text-slate-700 mt-1 whitespace-pre-line leading-relaxed text-[11px]">
                      {act.description}
                    </p>
                    {act.user && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
                        <User className="h-3 w-3" />
                        <span>Logged by {act.user.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "status" && (
        <div className="space-y-2.5">
          {statusHistories.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No status changes recorded.</p>
          ) : (
            statusHistories.map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-slate-200/90 bg-white text-xs space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {h.fromStatus ? (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: `${h.fromStatus.color}40`,
                          color: h.fromStatus.color,
                          backgroundColor: `${h.fromStatus.color}10`,
                        }}
                        className="text-[10px] font-mono"
                      >
                        {h.fromStatus.name}
                      </Badge>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">Initial</span>
                    )}
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    {h.toStatus ? (
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: `${h.toStatus.color}40`,
                          color: h.toStatus.color,
                          backgroundColor: `${h.toStatus.color}10`,
                        }}
                        className="text-[10px] font-mono"
                      >
                        {h.toStatus.name}
                      </Badge>
                    ) : (
                      <span className="text-slate-400 italic text-[10px]">None</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDate(h.changedAt)}
                  </span>
                </div>
                {h.changedBy && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>Changed by {h.changedBy.name}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "assignment" && (
        <div className="space-y-2.5">
          {assignmentHistories.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6 text-center">No assignment changes recorded.</p>
          ) : (
            assignmentHistories.map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-slate-200/90 bg-white text-xs space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-600 font-medium text-[11px]">
                      {h.fromUser ? h.fromUser.name : "Unassigned"}
                    </span>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <span className="text-slate-900 font-semibold text-[11px]">
                      {h.toUser ? h.toUser.name : "Unassigned"}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDate(h.assignedAt)}
                  </span>
                </div>
                {h.assignedBy && (
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>Assigned by {h.assignedBy.name}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
