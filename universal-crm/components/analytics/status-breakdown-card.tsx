import React from "react";
import { StatusDistributionItem } from "@/lib/services/analytics/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PieChart } from "lucide-react";

interface StatusBreakdownCardProps {
  statuses: StatusDistributionItem[];
  currency?: string;
  loading?: boolean;
}

export function StatusBreakdownCard({
  statuses,
  currency = "INR",
  loading,
}: StatusBreakdownCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-200/90 bg-white p-4 animate-pulse shadow-2xs">
        <div className="h-4 w-32 bg-slate-100 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-full bg-slate-100 rounded" />
              <div className="h-2 w-full bg-slate-50 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const totalCount = statuses.reduce((acc, s) => acc + s.count, 0);

  return (
    <Card className="border-slate-200/90 bg-white shadow-2xs">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <div>
          <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
            <PieChart className="h-3.5 w-3.5 text-slate-500" />
            <span>Lead Status Distribution</span>
          </CardTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {totalCount} leads across {statuses.length} active stages
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-2 px-4 pb-4 space-y-2.5">
        {statuses.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No status distribution data available.
          </div>
        ) : (
          statuses.map((status) => {
            const countPercent = totalCount > 0 ? Math.round((status.count / totalCount) * 100) : 0;

            return (
              <div key={status.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: status.color || "#4f46e5" }}
                    />
                    <span className="font-medium text-slate-800 truncate">{status.name}</span>
                  </div>

                  <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-500 shrink-0">
                    <span className="text-slate-900 font-semibold">{status.count}</span>
                    <span className="text-slate-500">({countPercent}%)</span>
                    <span className="text-slate-600 tabular-nums">{formatCurrency(status.value)}</span>
                  </div>
                </div>

                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(2, countPercent))}%`,
                      backgroundColor: status.color || "#4f46e5",
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
