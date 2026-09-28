"use client";

import React, { useState } from "react";
import { AnalyticsPreset } from "@/lib/validations/analytics";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw } from "lucide-react";

interface DateRangePickerProps {
  preset: AnalyticsPreset;
  from?: string;
  to?: string;
  onRangeChange: (preset: AnalyticsPreset, from?: string, to?: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

const PRESET_LABELS: { preset: AnalyticsPreset; label: string }[] = [
  { preset: "TODAY", label: "Today" },
  { preset: "YESTERDAY", label: "Yesterday" },
  { preset: "LAST_7_DAYS", label: "Last 7 Days" },
  { preset: "LAST_30_DAYS", label: "Last 30 Days" },
  { preset: "THIS_MONTH", label: "This Month" },
  { preset: "LAST_MONTH", label: "Last Month" },
  { preset: "THIS_QUARTER", label: "This Quarter" },
  { preset: "THIS_YEAR", label: "This Year" },
  { preset: "CUSTOM", label: "Custom Range" },
];

export function DateRangePicker({
  preset,
  from,
  to,
  onRangeChange,
  onRefresh,
  loading,
}: DateRangePickerProps) {
  const [showCustomInputs, setShowCustomInputs] = useState(preset === "CUSTOM");
  const [customFrom, setCustomFrom] = useState(from || "");
  const [customTo, setCustomTo] = useState(to || "");

  const handlePresetSelect = (selectedPreset: AnalyticsPreset) => {
    if (selectedPreset === "CUSTOM") {
      setShowCustomInputs(true);
    } else {
      setShowCustomInputs(false);
      onRangeChange(selectedPreset);
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customFrom && customTo) {
      onRangeChange("CUSTOM", customFrom, customTo);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-slate-400">
          <Calendar className="h-3.5 w-3.5 text-indigo-400" />
          <span>Range:</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {PRESET_LABELS.map((item) => (
            <button
              key={item.preset}
              onClick={() => handlePresetSelect(item.preset)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                preset === item.preset
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
        {showCustomInputs && (
          <form onSubmit={handleApplyCustom} className="flex items-center gap-1.5">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              required
            />
            <span className="text-xs text-slate-500">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              required
            />
            <Button
              type="submit"
              size="sm"
              className="h-7 px-2.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Apply
            </Button>
          </form>
        )}

        <Button
          onClick={onRefresh}
          disabled={loading}
          variant="outline"
          size="sm"
          className="h-8 px-2.5 border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 text-xs font-medium"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 text-slate-400 ${
              loading ? "animate-spin text-indigo-400" : ""
            }`}
          />
          <span>Refresh</span>
        </Button>
      </div>
    </div>
  );
}
