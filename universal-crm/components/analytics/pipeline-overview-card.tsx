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
  currency = "USD",
  loading,
}: PipelineOverviewCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-4 animate-pulse">
        <div className="h-5 w-40 bg-slate-800 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-800/60 rounded-lg" />
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
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-emerald-400" />
          <span>Pipeline & Revenue Overview</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span>Active Pipeline</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-white">
              {formatCurrency(pipeline.totalValue)}
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-blue-400" />
              <span>Average Deal</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-white">
              {formatCurrency(pipeline.avgDealValue)}
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span>Won Value</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-emerald-400">
              {formatCurrency(pipeline.convertedValue)}
            </div>
          </div>

          <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
              <XCircle className="h-3.5 w-3.5 text-rose-400" />
              <span>Lost Value</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-rose-400">
              {formatCurrency(pipeline.lostValue)}
            </div>
          </div>
        </div>

        {/* Funnel Stages Table/Rows */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Stages Funnel
          </span>

          <div className="space-y-2">
            {pipeline.stages.map((stage) => (
              <div
                key={stage.statusId}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs"
              >
                <div className="flex items-center space-x-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: stage.color || "#6366f1" }}
                  />
                  <span className="font-medium text-slate-200">{stage.stageName}</span>
                </div>

                <div className="flex items-center space-x-4">
                  <span className="text-slate-400">{stage.leadCount} deals</span>
                  <span className="font-semibold text-slate-200">
                    {formatCurrency(stage.totalValue)}
                  </span>
                  <span className="text-slate-500 font-mono w-12 text-right">
                    {stage.percentageOfPipeline}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
