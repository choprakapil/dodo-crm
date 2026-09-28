import React from "react";
import Link from "next/link";
import { FollowUpAnalytics } from "@/lib/services/analytics/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

interface FollowUpHealthCardProps {
  followUps: FollowUpAnalytics;
  loading?: boolean;
}

export function FollowUpHealthCard({
  followUps,
  loading,
}: FollowUpHealthCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-4 animate-pulse">
        <div className="h-5 w-40 bg-slate-800 rounded mb-4" />
        <div className="h-24 bg-slate-800/40 rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <span>Follow-up Health & Velocity</span>
        </CardTitle>
        <Link
          href="/app/follow-ups"
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
        >
          <span>Workspace</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Completion Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-medium">Task Completion Rate</span>
            <span className="text-emerald-400 font-bold font-mono">
              {followUps.completionRate}%
            </span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, followUps.completionRate))}%` }}
            />
          </div>
        </div>

        {/* 4 Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[11px] text-slate-400">Created in Period</div>
            <div className="text-base font-bold text-white mt-0.5">
              {followUps.created}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[11px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Completed</span>
            </div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {followUps.completed}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[11px] text-slate-400">Active Pending</div>
            <div className="text-base font-bold text-slate-200 mt-0.5">
              {followUps.pending}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5">
            <div className="text-[11px] text-rose-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Overdue</span>
            </div>
            <div className="text-base font-bold text-rose-400 mt-0.5">
              {followUps.overdue}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
