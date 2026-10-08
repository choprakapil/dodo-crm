"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Building,
  DollarSign,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PipelineLead, PipelineStatus } from "./kanban-board";

interface MobileStageSelectorModalProps {
  isOpen: boolean;
  lead: PipelineLead | null;
  statuses: PipelineStatus[];
  currentStatusId: string | null;
  onClose: () => void;
  onSelectStage: (leadId: string, targetStatusId: string) => Promise<void>;
  isUpdating: boolean;
}

export function MobileStageSelectorModal({
  isOpen,
  lead,
  statuses,
  currentStatusId,
  onClose,
  onSelectStage,
  isUpdating,
}: MobileStageSelectorModalProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  useEffect(() => {
    if (isOpen && currentStatusId) {
      setSelectedStageId(currentStatusId);
    }
  }, [isOpen, currentStatusId]);

  if (!isOpen || !lead) return null;

  const currentStatus = statuses.find((s) => s.id === currentStatusId) || statuses[0];
  const targetStatus = statuses.find((s) => s.id === selectedStageId);
  const isCurrentSelected = selectedStageId === currentStatusId;

  // Check client-side disposition gatekeeping
  const isClosedTarget = Boolean(targetStatus && /^(closed|won|lost|deal|converted)/i.test(targetStatus.name));
  const isGatekept = Boolean(
    isClosedTarget &&
    lead.disposition &&
    !lead.disposition.allowsClose &&
    !isCurrentSelected
  );

  const handleConfirm = async () => {
    if (!selectedStageId || isCurrentSelected || isGatekept || isUpdating) {
      if (isCurrentSelected) {
        onClose();
      }
      return;
    }
    await onSelectStage(lead.id, selectedStageId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUpdating) {
          onClose();
        }
      }}
    >
      <div className="w-full sm:max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Change Pipeline Stage
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select target workflow status for this lead.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lead Context Summary */}
        <div className="p-4 bg-indigo-50/30 border-b border-slate-100 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900 leading-tight">
                {lead.name}
              </h4>
              {lead.company && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                  <Building className="h-3 w-3 text-slate-400" />
                  <span>{lead.company}</span>
                </div>
              )}
            </div>
            {lead.amount !== null && (
              <span className="font-mono font-bold text-emerald-600 text-xs tabular-nums bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(lead.amount)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600">
            <span className="font-medium">Current Stage:</span>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-2xs"
              style={{ backgroundColor: currentStatus?.color || "#4f46e5" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
              {currentStatus?.name || "Initial"}
            </span>
          </div>
        </div>

        {/* Stage List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Available Pipeline Stages:
          </label>

          <div className="space-y-1.5" role="radiogroup" aria-label="Pipeline Stages">
            {statuses.map((status) => {
              const isSelected = selectedStageId === status.id;
              const isCurrent = currentStatusId === status.id;

              return (
                <button
                  key={status.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isUpdating}
                  onClick={() => setSelectedStageId(status.id)}
                  className={`w-full min-h-[44px] flex items-center justify-between p-3 rounded-xl border text-left transition-all active:scale-[0.99] ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/60 text-indigo-950 ring-1 ring-indigo-500/20 shadow-xs"
                      : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70 text-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs flex items-center justify-center"
                      style={{ backgroundColor: status.color || "#4f46e5" }}
                    />
                    <span className="text-xs font-semibold">{status.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium bg-slate-100 text-slate-600 border-slate-200 py-0"
                      >
                        Current
                      </Badge>
                    )}
                    {isSelected && !isCurrent && (
                      <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Disposition Gatekeeping Alert */}
          {isGatekept && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 mt-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Disposition Gatekeeping Active</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Cannot move to &quot;{targetStatus?.name}&quot;: Current disposition &quot;{lead.disposition?.name}&quot; does not allow closing without resolution.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/70">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUpdating}
            onClick={onClose}
            className="text-xs h-9"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isUpdating || isCurrentSelected || isGatekept}
            onClick={handleConfirm}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 shadow-2xs font-medium px-4"
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Moving...
              </>
            ) : isCurrentSelected ? (
              "Current Stage"
            ) : (
              <>
                Move to Stage
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
