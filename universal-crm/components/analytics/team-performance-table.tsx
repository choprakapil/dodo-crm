"use client";

import React, { useState } from "react";
import { TeamMemberPerformance } from "@/lib/services/analytics/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Download,
  Search,
} from "lucide-react";

interface TeamPerformanceTableProps {
  team: TeamMemberPerformance[];
  currency?: string;
  preset?: string;
  from?: string;
  to?: string;
  loading?: boolean;
}

export function TeamPerformanceTable({
  team,
  currency = "INR",
  preset = "LAST_30_DAYS",
  from,
  to,
  loading,
}: TeamPerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [exporting, setExporting] = useState(false);

  if (loading) {
    return (
      <Card className="border-slate-200/90 bg-white p-4 animate-pulse shadow-2xs">
        <div className="h-4 w-48 bg-slate-100 rounded mb-4" />
        <div className="h-40 bg-slate-50 rounded-lg" />
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

  const filteredTeam = team.filter(
    (member) =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.roleName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams({
        report: "team",
        preset,
      });
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/v1/analytics/export?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to export analytics CSV");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `team-performance-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="border-slate-200/90 bg-white shadow-2xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 pt-4 px-4">
        <div>
          <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
            <Users className="h-3.5 w-3.5 text-slate-500" />
            <span>Team &amp; Agent Performance Leaderboard</span>
          </CardTitle>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Performance metrics across {team.length} sales agents
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-indigo-500 w-36 sm:w-44 shadow-2xs"
            />
          </div>

          <Button
            onClick={handleExportCsv}
            disabled={exporting || team.length === 0}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs shadow-2xs"
          >
            <Download className="h-3 w-3 mr-1 text-slate-400" />
            <span>{exporting ? "..." : "Export"}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50/80 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Agent</th>
                <th className="py-2.5 px-3 text-right">Leads</th>
                <th className="py-2.5 px-3 text-right">New</th>
                <th className="py-2.5 px-3 text-right">Won</th>
                <th className="py-2.5 px-3 text-right">Conv. Rate</th>
                <th className="py-2.5 px-3 text-right">Pipeline</th>
                <th className="py-2.5 px-3 text-center">Follow-ups</th>
                <th className="py-2.5 px-4 text-center">Activities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTeam.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No team members found.
                  </td>
                </tr>
              ) : (
                filteredTeam.map((member) => (
                  <tr
                    key={member.userId}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0">
                          {member.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{member.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">{member.roleName}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 tabular-nums">
                      {member.assignedLeads}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 tabular-nums">
                      {member.newLeads}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600 tabular-nums">
                      {member.convertedLeads}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                      {member.conversionRate}%
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900 tabular-nums">
                      {formatCurrency(member.pipelineValue)}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className="font-mono text-slate-600 tabular-nums">
                        {member.completedFollowUps}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <span className="font-mono text-slate-500 tabular-nums">
                        {member.activitiesCount}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
