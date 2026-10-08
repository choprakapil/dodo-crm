"use client";

import { Badge } from "@/components/ui/badge";

export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface PriorityBadgeProps {
  priority: PriorityLevel;
  className?: string;
}

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  switch (priority) {
    case "URGENT":
      return (
        <Badge
          className={`bg-rose-50 text-rose-700 border-rose-200 font-semibold text-[10px] px-2 py-0.5 shadow-2xs ${className}`}
        >
          🔥 Urgent
        </Badge>
      );
    case "HIGH":
      return (
        <Badge
          className={`bg-amber-50 text-amber-700 border-amber-200 font-semibold text-[10px] px-2 py-0.5 shadow-2xs ${className}`}
        >
          ▲ High
        </Badge>
      );
    case "MEDIUM":
      return (
        <Badge
          className={`bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-[10px] px-2 py-0.5 shadow-2xs ${className}`}
        >
          ● Medium
        </Badge>
      );
    case "LOW":
      return (
        <Badge
          className={`bg-slate-100 text-slate-600 border-slate-200 font-medium text-[10px] px-2 py-0.5 shadow-2xs ${className}`}
        >
          ▽ Low
        </Badge>
      );
    default:
      return (
        <Badge className={`bg-slate-100 text-slate-600 border-slate-200 text-[10px] shadow-2xs ${className}`}>
          {priority}
        </Badge>
      );
  }
}

interface StatusPillProps {
  name: string;
  color?: string | null;
  className?: string;
}

export function StatusPill({ name, color, className = "" }: StatusPillProps) {
  const baseColor = color || "#4f46e5";
  return (
    <Badge
      style={{
        backgroundColor: `${baseColor}14`,
        color: baseColor,
        borderColor: `${baseColor}30`,
      }}
      className={`text-[11px] font-semibold border px-2 py-0.5 shadow-2xs ${className}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block"
        style={{ backgroundColor: baseColor }}
      />
      {name}
    </Badge>
  );
}
