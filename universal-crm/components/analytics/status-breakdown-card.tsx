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
  currency = "USD",
  loading,
}: StatusBreakdownCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-4 animate-pulse">
        <div className="h-4 w-32 bg-slate-800 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-full bg-slate-800/80 rounded" />
              <div className="h-2 w-full bg-slate-800/40 rounded" />
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
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <PieChart className="h-4 w-4 text-violet-400" />
            <span>Lead Status Distribution</span>
          </CardTitle>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalCount} leads across {statuses.length} stages
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-2 space-y-3">
        {statuses.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No status distribution data available.
          </div>
        ) : (
          statuses.map((status) => (
            <div key={status.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: status.color || "#6366f1" }}
                  />
                  <span className="font-medium text-slate-200">{status.name}</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-400">
                  <span>{status.count} leads</span>
                  <span className="text-slate-500 font-mono">({status.percentage}%)</span>
                  {status.value > 0 && (
                    <span className="text-slate-300 font-medium">
                      {formatCurrency(status.value)}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(status.percentage, status.count > 0 ? 3 : 0))}%`,
                    backgroundColor: status.color || "#6366f1",
                  }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
