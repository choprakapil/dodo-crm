"use client";

import React from "react";
import { CheckSquare, Square, MinusSquare } from "lucide-react";

interface BulkCheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function BulkCheckbox({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  ariaLabel = "Select row",
  className = "",
}: BulkCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onChange) onChange();
      }}
      className={`inline-flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {checked ? (
        <CheckSquare className="h-4 w-4 text-indigo-600 fill-indigo-50" />
      ) : indeterminate ? (
        <MinusSquare className="h-4 w-4 text-indigo-600 fill-indigo-50" />
      ) : (
        <Square className="h-4 w-4 text-slate-300 hover:text-slate-400" />
      )}
    </button>
  );
}
