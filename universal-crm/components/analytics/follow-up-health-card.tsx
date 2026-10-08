import React from "react";
import Link from "next/link";
import { FollowUpAnalytics } from "@/lib/services/analytics/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock, ArrowRight } from "lucide-react";

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
      <Card className="border-slate-200/90 bg-white p-4 animate-pulse shadow-2xs">
        <div className="h-4 w-40 bg-slate-100 rounded mb-4" />
        <div className="h-24 bg-slate-50 rounded-lg" />
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/90 bg-white shadow-2xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
        <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <span>Follow-up Health &amp; Velocity</span>
        </CardTitle>
        <Link
          href="/app/follow-ups"
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 transition"
        >
          <span>Workspace</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3.5">
        {/* Completion Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-600 font-medium">Task Completion Rate</span>
            <span className="text-emerald-600 font-bold font-mono tabular-nums">
              {followUps.completionRate}%
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, followUps.completionRate))}%` }}
            />
          </div>
        </div>

        {/* 4 Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5">
            <div className="text-[11px] text-slate-500 mb-0.5">Total Tasks</div>
            <div className="text-sm sm:text-base font-bold text-slate-900 font-mono tabular-nums">
              {followUps.created}
            </div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2.5">
            <div className="text-[11px] text-emerald-700 mb-0.5">Completed</div>
            <div className="text-sm sm:text-base font-bold text-emerald-700 font-mono tabular-nums">
              {followUps.completed}
            </div>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5">
            <div className="text-[11px] text-slate-500 mb-0.5">Pending</div>
            <div className="text-sm sm:text-base font-bold text-slate-800 font-mono tabular-nums">
              {followUps.pending}
            </div>
          </div>

          <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-2.5">
            <div className="text-[11px] text-rose-700 mb-0.5">Overdue</div>
            <div className="text-sm sm:text-base font-bold text-rose-700 font-mono tabular-nums">
              {followUps.overdue}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
