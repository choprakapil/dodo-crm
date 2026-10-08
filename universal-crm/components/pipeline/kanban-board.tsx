"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PriorityBadge, PriorityLevel } from "@/components/leads/lead-badge";
import { getTelUrl, getWhatsAppUrl } from "@/lib/utils/contact-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building,
  Phone,
  MessageSquare,
  DollarSign,
  User,
  ArrowRight,
  ExternalLink,
  Loader2,
  Sparkles,
  AlertTriangle,
  ArrowRightLeft,
} from "lucide-react";
import { MobileStageSelectorModal } from "./mobile-stage-selector-modal";

export interface PipelineLead {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  amount: number | null;
  priority: PriorityLevel;
  statusId: string | null;
  createdAt: string;
  assignedUser: { id: string; name: string } | null;
  disposition: {
    id: string;
    name: string;
    color: string | null;
    allowsClose: boolean;
    allowsConvert: boolean;
  } | null;
}

export interface PipelineStatus {
  id: string;
  name: string;
  color: string;
  displayOrder: number;
}

interface KanbanBoardProps {
  statuses: PipelineStatus[];
  initialLeads: PipelineLead[];
  currency: string;
}

export function KanbanBoard({ statuses, initialLeads, currency }: KanbanBoardProps) {
  const [leads, setLeads] = useState<PipelineLead[]>(initialLeads);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [draggedFromStatusId, setDraggedFromStatusId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [modalLead, setModalLead] = useState<PipelineLead | null>(null);

  function formatAmount(val: number | null) {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(val);
  }

  // Shared Stage Movement Logic (used by both Desktop Drag-and-Drop and Mobile Stage Selector)
  const moveToStage = async (leadId: string, targetStatusId: string) => {
    const movingLead = leads.find((l) => l.id === leadId);
    const targetStatus = statuses.find((s) => s.id === targetStatusId);

    if (!movingLead || !targetStatus) {
      return;
    }

    const fromStatusId = movingLead.statusId;
    if (fromStatusId === targetStatusId) {
      return;
    }

    // Client-side pre-check for disposition gatekeeping on closed/won/converted
    const isClosedTarget = /^(closed|won|lost|deal|converted)/i.test(targetStatus.name);
    if (isClosedTarget && movingLead.disposition && !movingLead.disposition.allowsClose) {
      toast.error("Disposition Gatekeeping Active", {
        description: `Cannot move to "${targetStatus.name}": Current disposition "${movingLead.disposition.name}" does not allow closing.`,
      });
      return;
    }

    // 1. Optimistic Update
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, statusId: targetStatusId } : lead
      )
    );
    setIsUpdating(leadId);

    try {
      // 2. Server Request
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId: targetStatusId }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        // Rollback
        setLeads((prev) =>
          prev.map((lead) =>
            lead.id === leadId ? { ...lead, statusId: fromStatusId } : lead
          )
        );
        toast.error("Move Failed", {
          description: json.error?.message || "Failed to update lead status on server.",
        });
      } else {
        toast.success("Stage Updated", {
          description: `${movingLead.name} moved to ${targetStatus.name}`,
        });
      }
    } catch {
      // Rollback on network failure
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, statusId: fromStatusId } : lead
        )
      );
      toast.error("Network Error", {
        description: "Could not connect to server. Stage transition reverted.",
      });
    } finally {
      setIsUpdating(null);
    }
  };

  // Handle Drag Start
  const handleDragStart = (leadId: string, currentStatusId: string | null) => {
    setDraggedLeadId(leadId);
    setDraggedFromStatusId(currentStatusId);
  };

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    if (dragOverColumnId !== statusId) {
      setDragOverColumnId(statusId);
    }
  };

  // Handle Drag Leave
  const handleDragLeave = (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    if (dragOverColumnId === statusId) {
      setDragOverColumnId(null);
    }
  };

  // Handle Drop and Stage Transition
  const handleDrop = async (e: React.DragEvent, targetStatusId: string) => {
    e.preventDefault();
    setDragOverColumnId(null);

    const leadId = draggedLeadId;
    setDraggedLeadId(null);
    setDraggedFromStatusId(null);

    if (leadId) {
      await moveToStage(leadId, targetStatusId);
    }
  };

  // Group leads by status
  const leadsByStatus = new Map<string, PipelineLead[]>();
  for (const status of statuses) {
    leadsByStatus.set(status.id, []);
  }

  for (const lead of leads) {
    const list = lead.statusId ? leadsByStatus.get(lead.statusId) : null;
    if (list) {
      list.push(lead);
    } else if (statuses[0]) {
      // Fallback to first status if not matched
      const fallbackList = leadsByStatus.get(statuses[0].id);
      fallbackList?.push(lead);
    }
  }

  return (
    <div className="space-y-4">
      {/* Mobile Stage Selector Pills (<640px) */}
      <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {statuses.map((status) => {
          const count = (leadsByStatus.get(status.id) || []).length;
          return (
            <button
              key={`pill-${status.id}`}
              onClick={() => {
                const el = document.getElementById(`kanban-col-${status.id}`);
                el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-300 active:scale-95 transition shadow-2xs"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: status.color || "#4f46e5" }}
              />
              <span>{status.name}</span>
              <span className="text-[10px] text-slate-400 font-mono">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Board Columns Container */}
      <div className="flex items-start gap-4 overflow-x-auto pb-6 pt-1 select-none snap-x snap-mandatory scroll-smooth">
        {statuses.map((status) => {
          const columnLeads = leadsByStatus.get(status.id) || [];
          const totalValue = columnLeads.reduce(
            (acc, l) => acc + (l.amount ? Number(l.amount) : 0),
            0
          );
          const isOver = dragOverColumnId === status.id;

          return (
            <div
              key={status.id}
              id={`kanban-col-${status.id}`}
              onDragOver={(e) => handleDragOver(e, status.id)}
              onDragLeave={(e) => handleDragLeave(e, status.id)}
              onDrop={(e) => handleDrop(e, status.id)}
              className={`w-[84vw] sm:w-80 shrink-0 snap-center rounded-xl border flex flex-col max-h-[calc(100vh-220px)] transition-all ${
                isOver
                  ? "border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20"
                  : "border-slate-200/90 bg-slate-100/60 shadow-2xs"
              }`}
            >
              {/* Column Header */}
              <div className="p-3 border-b border-slate-200/80 bg-white rounded-t-xl space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: status.color || "#4f46e5" }}
                    />
                    <h3 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                      {status.name}
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-slate-200 text-slate-600 bg-slate-50 text-[10px] px-2 py-0 font-semibold"
                  >
                    {columnLeads.length}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Pipeline Value</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatAmount(totalValue)}
                  </span>
                </div>
              </div>

              {/* Column Cards List */}
              <div className="p-2 space-y-2.5 overflow-y-auto flex-1 min-h-[160px]">
                {columnLeads.length === 0 ? (
                  <div className="h-28 border border-dashed border-slate-200/90 bg-white/40 rounded-xl flex items-center justify-center text-slate-400 text-xs text-center p-3">
                    Drag deals here
                  </div>
                ) : (
                  columnLeads.map((lead) => {
                    const isCardUpdating = isUpdating === lead.id;
                    const telUrl = getTelUrl(lead.phone);
                    const waUrl = getWhatsAppUrl(lead.phone);

                    return (
                      <div
                        key={lead.id}
                        draggable={!isCardUpdating}
                        onDragStart={() => handleDragStart(lead.id, lead.statusId)}
                        className={`p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-indigo-300 hover:shadow-xs shadow-2xs space-y-2.5 transition cursor-grab active:cursor-grabbing ${
                          isCardUpdating ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        {/* Card Header: Name & Priority */}
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/app/leads/${lead.id}`}
                            className="font-semibold text-slate-900 text-xs hover:text-indigo-600 transition flex items-center gap-1 group"
                          >
                            <span className="truncate max-w-[170px]">{lead.name}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition text-slate-400 shrink-0" />
                          </Link>
                          <PriorityBadge priority={lead.priority} />
                        </div>

                        {/* Company & Deal Amount */}
                        <div className="flex items-center justify-between text-[11px]">
                          {lead.company ? (
                            <span className="text-slate-500 flex items-center gap-1 truncate max-w-[130px]">
                              <Building className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{lead.company}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">No company</span>
                          )}
                          <span className="font-mono font-bold text-emerald-600 tabular-nums text-xs">
                            {formatAmount(lead.amount)}
                          </span>
                        </div>

                        {/* Disposition Tag if exists */}
                        {lead.disposition && (
                          <div className="pt-0.5">
                            <span
                              style={{
                                color: lead.disposition.color || "#4f46e5",
                                backgroundColor: `${lead.disposition.color || "#4f46e5"}14`,
                                borderColor: `${lead.disposition.color || "#4f46e5"}30`,
                              }}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded border inline-block truncate max-w-full shadow-2xs"
                            >
                              {lead.disposition.name}
                            </span>
                          </div>
                        )}

                        {/* Stage Selector Action Bar (Touch-friendly for mobile & accessible for keyboard/desktop) */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalLead(lead);
                            }}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 active:scale-95 transition px-2 py-1 -ml-1 rounded-md hover:bg-indigo-50/70 cursor-pointer"
                            title="Change stage"
                            aria-label={`Change stage for ${lead.name}`}
                          >
                            <ArrowRightLeft className="h-3 w-3 text-indigo-500 shrink-0" />
                            <span>
                              Move Stage <span className="text-slate-400 font-normal">({status.name})</span>
                            </span>
                          </button>
                        </div>

                        {/* Footer: Assignee & Direct Contact Actions */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                          <div className="flex items-center gap-1 truncate max-w-[120px]">
                            <User className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate text-slate-600 font-medium">
                              {lead.assignedUser ? lead.assignedUser.name : "Unassigned"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {telUrl && (
                              <a
                                href={telUrl}
                                title="Call"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 transition"
                              >
                                <Phone className="h-3 w-3" />
                              </a>
                            )}
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded-md bg-green-50 hover:bg-green-100 text-green-700 border border-green-200/60 transition"
                              >
                                <MessageSquare className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Touch Stage Selector Modal */}
      <MobileStageSelectorModal
        isOpen={Boolean(modalLead)}
        lead={modalLead}
        statuses={statuses}
        currentStatusId={modalLead?.statusId ?? null}
        onClose={() => setModalLead(null)}
        onSelectStage={moveToStage}
        isUpdating={Boolean(isUpdating)}
      />
    </div>
  );
}
