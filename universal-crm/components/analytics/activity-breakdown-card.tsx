import React from "react";
import { ActivityAnalytics } from "@/lib/services/analytics/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Activity,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  FileText,
} from "lucide-react";

interface ActivityBreakdownCardProps {
  activities: ActivityAnalytics;
  loading?: boolean;
}

export function ActivityBreakdownCard({
  activities,
  loading,
}: ActivityBreakdownCardProps) {
  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-4 animate-pulse">
        <div className="h-5 w-36 bg-slate-800 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-slate-800/40 rounded-lg" />
          ))}
        </div>
      </Card>
    );
  }

  const items = [
    {
      label: "Calls",
      count: activities.byType.CALL,
      icon: Phone,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      label: "WhatsApp",
      count: activities.byType.WHATSAPP,
      icon: MessageSquare,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Emails",
      count: activities.byType.EMAIL,
      icon: Mail,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Meetings",
      count: activities.byType.MEETING,
      icon: Calendar,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/20",
    },
    {
      label: "Notes",
      count: activities.byType.NOTE,
      icon: FileText,
      color: "text-pink-400",
      bg: "bg-pink-500/10 border-pink-500/20",
    },
  ];

  return (
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span>Activity & Outreach</span>
          </CardTitle>
          <span className="text-xs text-slate-400 font-mono font-medium">
            {activities.total} total
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {items.map((item) => {
            const Icon = item.icon;
            const pct =
              activities.total > 0
                ? Math.round((item.count / activities.total) * 100)
                : 0;

            return (
              <div
                key={item.label}
                className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400 font-medium">
                    {item.label}
                  </span>
                  <div
                    className={`h-6 w-6 rounded-md flex items-center justify-center border ${item.bg} ${item.color}`}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold text-white tracking-tight">
                    {item.count}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
