"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, HelpCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkAction } from "./types";

interface BulkConfirmModalProps {
  action: BulkAction | null;
  selectedCount: number;
  isOpen: boolean;
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: (extraData?: any) => void;
}

export function BulkConfirmModal({
  action,
  selectedCount,
  isOpen,
  isProcessing,
  onClose,
  onConfirm,
}: BulkConfirmModalProps) {
  const [reason, setReason] = useState("");
  const [selectedValue, setSelectedValue] = useState("");
  const [typedConfirm, setTypedConfirm] = useState("");

  useEffect(() => {
    if (isOpen && action) {
      setReason("");
      setTypedConfirm("");
      if (action.selectOptions && action.selectOptions.length > 0) {
        setSelectedValue(action.selectOptions[0].value);
      } else {
        setSelectedValue("");
      }
    }
  }, [isOpen, action]);

  if (!isOpen || !action) return null;

  const isDestructive = action.destructive || action.variant === "destructive";
  const confirmType = action.confirmType || (isDestructive ? "typed_delete" : "simple");

  const canSubmit = () => {
    if (isProcessing) return false;
    if (confirmType === "typed_delete") {
      return typedConfirm === "DELETE";
    }
    if (confirmType === "select") {
      return Boolean(selectedValue);
    }
    return true;
  };

  const handleConfirm = () => {
    if (!canSubmit()) return;
    const extraData: any = {};
    if (confirmType === "reason") extraData.reason = reason;
    if (confirmType === "select") extraData.selectedValue = selectedValue;
    onConfirm(extraData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                isDestructive
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-indigo-50 text-indigo-600 border-indigo-200"
              }`}
            >
              {isDestructive ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <HelpCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {action.confirmTitle || `${action.label} (${selectedCount})`}
              </h3>
              <p className="text-xs text-slate-500">
                {action.confirmDescription ||
                  `Are you sure you want to apply this action to ${selectedCount} selected items?`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input Bodies */}
        {confirmType === "reason" && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Reason / Memo (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={action.confirmPlaceholder || "Enter reason for this bulk update..."}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}

        {confirmType === "select" && action.selectOptions && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              {action.selectLabel || "Select Target Option"}
            </label>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {action.selectOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedValue(opt.value)}
                  className={`flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-colors ${
                    selectedValue === opt.value
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-900"
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                  {opt.description && (
                    <span className="text-[10px] text-slate-500">{opt.description}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {confirmType === "typed_delete" && (
          <div className="space-y-2">
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 space-y-1">
              <p className="font-semibold">
                Warning: You are performing a destructive operation on {selectedCount} items.
              </p>
              <p className="text-[11px] text-rose-700">
                This action cannot be undone. Please confirm by typing below.
              </p>
            </div>
            <label className="block text-xs font-medium text-slate-700">
              Type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm:
            </label>
            <input
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isProcessing}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isDestructive ? "destructive" : "default"}
            disabled={!canSubmit()}
            onClick={handleConfirm}
            className={
              !isDestructive && action.variant === "warning"
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : isDestructive
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }
          >
            {isProcessing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Confirm {action.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
