import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Minus, LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  changePercent?: number;
  previousValue?: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  subtitle?: string;
  loading?: boolean;
}

export function KpiCard({
  title,
  value,
  changePercent,
  previousValue,
  icon: Icon,
  iconColor = "text-indigo-400",
  iconBg = "bg-indigo-500/10 border-indigo-500/20",
  subtitle,
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-4 animate-pulse">
        <div className="flex justify-between items-start mb-3">
          <div className="h-4 w-24 bg-slate-800 rounded" />
          <div className="h-8 w-8 bg-slate-800 rounded-lg" />
        </div>
        <div className="h-7 w-32 bg-slate-800 rounded mb-2" />
        <div className="h-3 w-20 bg-slate-800/80 rounded" />
      </Card>
    );
  }

  const isPositive = changePercent !== undefined && changePercent > 0;
  const isNegative = changePercent !== undefined && changePercent < 0;
  const isNeutral = changePercent !== undefined && changePercent === 0;

  return (
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur hover:border-slate-700/80 transition shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          <div
            className={`h-9 w-9 rounded-xl flex items-center justify-center border ${iconBg} ${iconColor} shadow-inner`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {value}
          </span>

          {changePercent !== undefined && (
            <div
              className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                isPositive
                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  : isNegative
                  ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
                  : "text-slate-400 bg-slate-800/40 border-slate-700/40"
              }`}
            >
              {isPositive && <ArrowUpRight className="h-3 w-3" />}
              {isNegative && <ArrowDownRight className="h-3 w-3" />}
              {isNeutral && <Minus className="h-3 w-3" />}
              <span>{Math.abs(changePercent)}%</span>
            </div>
          )}
        </div>

        {(subtitle || previousValue !== undefined) && (
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            {subtitle ? <span>{subtitle}</span> : <span />}
            {previousValue !== undefined && (
              <span className="text-[11px] text-slate-500">
                prev: {previousValue}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
