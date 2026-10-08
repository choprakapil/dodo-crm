"use client";

import React, { useState } from "react";
import { X, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkAction, BulkActionResult } from "./types";
import { BulkConfirmModal } from "./bulk-confirm-modal";
import { BulkResultModal } from "./bulk-result-modal";

interface BulkActionToolbarProps {
  selectedCount: number;
  selectedIds: string[];
  actions: BulkAction[];
  onClearSelection: () => void;
  onActionComplete?: (result: BulkActionResult) => void;
  entityName?: string;
  totalMatchingCount?: number;
  isAllAcrossPagesSelected?: boolean;
  onSelectAllAcrossPages?: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  selectedIds,
  actions,
  onClearSelection,
  onActionComplete,
  entityName = "items",
  totalMatchingCount,
  isAllAcrossPagesSelected,
  onSelectAllAcrossPages,
}: BulkActionToolbarProps) {
  const [activeAction, setActiveAction] = useState<BulkAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [resultModalData, setResultModalData] = useState<BulkActionResult | null>(null);

  if (selectedCount === 0) return null;

  const handleActionClick = (action: BulkAction) => {
    setIsMobileMenuOpen(false);
    if (action.onCustomClick) {
      action.onCustomClick(selectedIds);
      return;
    }
    if (action.requiresConfirmation || action.confirmType || action.destructive || action.variant === "destructive") {
      setActiveAction(action);
    } else {
      executeAction(action);
    }
  };

  const executeAction = async (action: BulkAction, extraData?: any) => {
    setIsProcessing(true);
    try {
      const result = await action.onExecute(selectedIds, extraData);
      setActiveAction(null);
      setResultModalData(result);
      if (onActionComplete) {
        onActionComplete(result);
      }
    } catch (err: any) {
      setResultModalData({
        success: false,
        total: selectedCount,
        succeededCount: 0,
        failedCount: selectedCount,
        failed: selectedIds.map((id) => ({
          id,
          error: err?.message || "Operation failed",
        })),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex max-w-[95vw] sm:max-w-4xl items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 text-white shadow-2xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-5">
        {/* Counter Badge */}
        <div className="flex items-center gap-2 border-r border-slate-700 pr-3 shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
            {selectedCount}
          </span>
          <span className="text-xs font-medium text-slate-200 hidden sm:inline">
            Selected
          </span>
        </div>

        {/* Optional: Select All Across Entire Dataset Semantics (PRD §3) */}
        {totalMatchingCount && totalMatchingCount > selectedCount && onSelectAllAcrossPages && (
          <div className="hidden md:flex items-center text-[11px] text-slate-300 border-r border-slate-700 pr-3">
            {!isAllAcrossPagesSelected ? (
              <button
                type="button"
                onClick={onSelectAllAcrossPages}
                className="underline hover:text-indigo-400 font-medium text-indigo-300"
              >
                Select all {totalMatchingCount.toLocaleString()} {entityName}
              </button>
            ) : (
              <span className="text-indigo-400 font-semibold">
                All {totalMatchingCount.toLocaleString()} selected
              </span>
            )}
          </div>
        )}

        {/* Desktop Actions */}
        <div className="hidden sm:flex items-center gap-2 overflow-x-auto py-0.5">
          {actions.map((action) => {
            const Icon = action.icon;
            const isDestructive = action.destructive || action.variant === "destructive";
            const isWarning = action.variant === "warning";

            return (
              <Button
                key={action.id}
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={() => handleActionClick(action)}
                className={`h-8 text-xs font-medium transition-colors ${
                  isDestructive
                    ? "border-rose-900 bg-rose-950/80 text-rose-300 hover:bg-rose-900 hover:text-white"
                    : isWarning
                    ? "border-amber-800 bg-amber-950/70 text-amber-300 hover:bg-amber-900 hover:text-white"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
                {action.label}
              </Button>
            );
          })}
        </div>

        {/* Mobile Dropdown Trigger */}
        <div className="sm:hidden flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="h-8 border-slate-700 bg-slate-800 text-xs text-slate-200"
          >
            Actions <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Clear Selection */}
        <button
          type="button"
          onClick={onClearSelection}
          disabled={isProcessing}
          className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile Bottom Action Sheet */}
      {isMobileMenuOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl space-y-2 animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-300">
              <span>Bulk Actions ({selectedCount} {entityName})</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 pt-1">
              {actions.map((action) => {
                const Icon = action.icon;
                const isDestructive = action.destructive || action.variant === "destructive";
                const isWarning = action.variant === "warning";
                return (
                  <Button
                    key={action.id}
                    size="sm"
                    variant="outline"
                    onClick={() => handleActionClick(action)}
                    className={`h-9 w-full justify-start text-xs ${
                      isDestructive
                        ? "border-rose-900 bg-rose-950/80 text-rose-300"
                        : isWarning
                        ? "border-amber-800 bg-amber-950/70 text-amber-300"
                        : "border-slate-700 bg-slate-800 text-slate-200"
                    }`}
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Universal Confirm Modal */}
      <BulkConfirmModal
        action={activeAction}
        selectedCount={selectedCount}
        isOpen={Boolean(activeAction)}
        isProcessing={isProcessing}
        onClose={() => setActiveAction(null)}
        onConfirm={(extraData) => {
          if (activeAction) {
            executeAction(activeAction, extraData);
          }
        }}
      />

      {/* Universal Result Modal */}
      <BulkResultModal
        result={resultModalData}
        isOpen={Boolean(resultModalData)}
        onClose={() => {
          setResultModalData(null);
          onClearSelection();
        }}
      />
    </>
  );
}
