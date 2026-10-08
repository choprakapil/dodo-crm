import React from "react";
import { PipelineAnalytics } from "@/lib/services/analytics/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DollarSign, Layers, CheckCircle, XCircle } from "lucide-react";

interface PipelineOverviewCardProps {
  pipeline: PipelineAnalytics;
  currency?: string;
  loading?: boolean;
}

export function PipelineOverviewCard({
  pipeline,
  currency = "INR",
  loading,
}: PipelineOverviewCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-200/90 bg-white p-4 animate-pulse shadow-2xs">
        <div className="h-4 w-32 bg-slate-100 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-lg" />
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

  return (
    <Card className="border-slate-200/90 bg-white shadow-2xs">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
          <span>Pipeline &amp; Revenue Overview</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3.5">
        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 mb-1">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              <span>Active Pipeline</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(pipeline.totalValue)}
            </div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-xs text-emerald-700 mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>Converted Deals</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-emerald-700 tabular-nums">
              {formatCurrency(pipeline.convertedValue)}
            </div>
          </div>

          <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-xs text-rose-600 mb-1">
              <XCircle className="h-3.5 w-3.5 text-rose-500" />
              <span>Lost Value</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-rose-600 tabular-nums">
              {formatCurrency(pipeline.lostValue)}
            </div>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-slate-400" />
              <span>Average Deal</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 tabular-nums">
              {formatCurrency(pipeline.avgDealValue)}
            </div>
          </div>
        </div>

        {/* Stage breakdown bars */}
        {pipeline.stages && pipeline.stages.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-200/80">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Stage Distribution
            </div>
            <div className="space-y-1.5">
              {pipeline.stages.map((stage) => {
                const percent = stage.percentageOfPipeline || (pipeline.totalValue > 0
                  ? Math.round((stage.totalValue / pipeline.totalValue) * 100)
                  : 0);
                return (
                  <div key={stage.statusId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-800 font-medium">{stage.stageName}</span>
                      <span className="text-slate-500 font-mono text-[11px] tabular-nums">
                        {formatCurrency(stage.totalValue)} ({stage.leadCount})
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
