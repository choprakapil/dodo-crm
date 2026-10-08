"use client";

import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkActionResult } from "./types";

interface BulkResultModalProps {
  result: BulkActionResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BulkResultModal({ result, isOpen, onClose }: BulkResultModalProps) {
  if (!isOpen || !result) return null;

  const hasFailures = (result.failedCount ?? 0) > 0;
  const hasSkips = (result.skippedCount ?? 0) > 0;
  const isFullySuccessful = !hasFailures && !hasSkips;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                isFullySuccessful
                  ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                  : hasFailures
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-amber-50 text-amber-600 border-amber-200"
              }`}
            >
              {isFullySuccessful ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : hasFailures ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isFullySuccessful
                  ? "Bulk Operation Completed"
                  : hasFailures
                  ? "Bulk Operation Completed with Errors"
                  : "Bulk Operation Completed with Notice"}
              </h3>
              <p className="text-xs text-slate-500">
                Processed {result.total} total items
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200 text-center">
          <div className="rounded-lg bg-white p-2 border border-slate-100 shadow-2xs">
            <div className="text-xs text-slate-500">Succeeded</div>
            <div className="text-base font-bold text-emerald-600">{result.succeededCount}</div>
          </div>
          <div className="rounded-lg bg-white p-2 border border-slate-100 shadow-2xs">
            <div className="text-xs text-slate-500">Skipped</div>
            <div className="text-base font-bold text-amber-600">{result.skippedCount ?? 0}</div>
          </div>
          <div className="rounded-lg bg-white p-2 border border-slate-100 shadow-2xs">
            <div className="text-xs text-slate-500">Failed</div>
            <div className="text-base font-bold text-rose-600">{result.failedCount}</div>
          </div>
        </div>

        {/* Skipped Items Details */}
        {result.skipped && result.skipped.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-amber-800">Skipped Items</h4>
            <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-amber-200 bg-amber-50/50 p-2 text-[11px] text-amber-700">
              {result.skipped.map((s, idx) => (
                <div key={idx} className="flex justify-between gap-2 border-b border-amber-100 pb-1 last:border-0 last:pb-0">
                  <span className="font-mono">{s.id.slice(0, 10)}...</span>
                  <span className="text-right text-amber-800">{s.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Items Details */}
        {result.failed && result.failed.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-rose-800">Failed Items</h4>
            <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-rose-200 bg-rose-50/50 p-2 text-[11px] text-rose-700">
              {result.failed.map((f, idx) => (
                <div key={idx} className="flex justify-between gap-2 border-b border-rose-100 pb-1 last:border-0 last:pb-0">
                  <span className="font-mono">{f.id.slice(0, 10)}...</span>
                  <span className="text-right text-rose-800">{f.error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-100">
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
