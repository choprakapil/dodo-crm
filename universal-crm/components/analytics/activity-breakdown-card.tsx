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
      <Card className="border-slate-200/90 bg-white shadow-2xs p-4 animate-pulse">
        <div className="h-5 w-36 bg-slate-100 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-lg" />
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
      color: "text-blue-600",
      bg: "bg-blue-50 border-blue-200/80",
    },
    {
      label: "WhatsApp",
      count: activities.byType.WHATSAPP,
      icon: MessageSquare,
      color: "text-emerald-600",
      bg: "bg-emerald-50 border-emerald-200/80",
    },
    {
      label: "Emails",
      count: activities.byType.EMAIL,
      icon: Mail,
      color: "text-amber-600",
      bg: "bg-amber-50 border-amber-200/80",
    },
    {
      label: "Meetings",
      count: activities.byType.MEETING,
      icon: Calendar,
      color: "text-violet-600",
      bg: "bg-violet-50 border-violet-200/80",
    },
    {
      label: "Notes",
      count: activities.byType.NOTE,
      icon: FileText,
      color: "text-pink-600",
      bg: "bg-pink-50 border-pink-200/80",
    },
  ];

  return (
    <Card className="border-slate-200/90 bg-white shadow-2xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" />
            <span>Activity &amp; Outreach</span>
          </CardTitle>
          <span className="text-xs text-slate-500 font-mono font-medium">
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
                className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-600 font-medium">
                    {item.label}
                  </span>
                  <div
                    className={`h-6 w-6 rounded-md flex items-center justify-center border ${item.bg} ${item.color}`}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold text-slate-900 tracking-tight">
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
