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
  iconColor = "text-zinc-300",
  iconBg = "bg-zinc-800/60 border-zinc-700/60",
  subtitle,
  loading,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-200/90 bg-white p-4 animate-pulse shadow-2xs">
        <div className="flex justify-between items-start mb-3">
          <div className="h-3 w-20 bg-slate-100 rounded" />
          <div className="h-7 w-7 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-6 w-24 bg-slate-100 rounded mb-2" />
        <div className="h-2.5 w-16 bg-slate-100/80 rounded" />
      </Card>
    );
  }

  const isPositive = changePercent !== undefined && changePercent > 0;
  const isNegative = changePercent !== undefined && changePercent < 0;
  const isNeutral = changePercent !== undefined && changePercent === 0;

  return (
    <Card className="border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs hover:shadow-xs">
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-medium text-slate-500">
            {title}
          </span>
          <div
            className={`h-7 w-7 rounded-lg flex items-center justify-center border ${iconBg} ${iconColor} transition-transform hover:scale-105`}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight tabular-nums font-sans">
            {value}
          </span>

          {changePercent !== undefined && (
            <div
              className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md border ${
                isPositive
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : isNegative
                  ? "text-rose-700 bg-rose-50 border-rose-200"
                  : "text-slate-600 bg-slate-100 border-slate-200"
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
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            {subtitle ? <span>{subtitle}</span> : <span />}
            {previousValue !== undefined && (
              <span className="text-[10px] text-slate-400 font-mono">
                prev: {previousValue}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
