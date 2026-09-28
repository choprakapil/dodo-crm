"use client";

import React, { useState } from "react";
import { TeamMemberPerformance } from "@/lib/services/analytics/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Download,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
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
  currency = "USD",
  preset = "LAST_30_DAYS",
  from,
  to,
  loading,
}: TeamPerformanceTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [exporting, setExporting] = useState(false);

  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur p-4 animate-pulse">
        <div className="h-5 w-48 bg-slate-800 rounded mb-4" />
        <div className="h-40 bg-slate-800/40 rounded-lg" />
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
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-400" />
            <span>Team & Agent Performance Leaderboard</span>
          </CardTitle>
          <p className="text-xs text-slate-400 mt-0.5">
            Scoped to your authorized viewing visibility ({team.length} agents)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
            />
          </div>

          <Button
            onClick={handleExportCsv}
            disabled={exporting || team.length === 0}
            variant="outline"
            size="sm"
            className="h-8 px-2.5 border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-slate-300 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
            <span>{exporting ? "Exporting..." : "Export CSV"}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-y border-slate-800 bg-slate-950/40 text-slate-400 font-semibold">
                <th className="py-2.5 px-4">Agent</th>
                <th className="py-2.5 px-3 text-right">Leads</th>
                <th className="py-2.5 px-3 text-right">New</th>
                <th className="py-2.5 px-3 text-right">Won</th>
                <th className="py-2.5 px-3 text-right">Conv. Rate</th>
                <th className="py-2.5 px-3 text-right">Pipeline</th>
                <th className="py-2.5 px-3 text-center">Follow-ups</th>
                <th className="py-2.5 px-4 text-center">Interactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTeam.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No agents found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredTeam.map((agent) => (
                  <tr
                    key={agent.userId}
                    className="hover:bg-slate-800/30 transition"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{agent.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span>{agent.email}</span>
                        <Badge
                          variant="secondary"
                          className="bg-slate-800 text-slate-300 text-[9px] px-1 py-0"
                        >
                          {agent.roleName}
                        </Badge>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-200">
                      {agent.assignedLeads}
                    </td>

                    <td className="py-3 px-3 text-right text-slate-300">
                      {agent.newLeads}
                    </td>

                    <td className="py-3 px-3 text-right text-emerald-400 font-medium">
                      {agent.convertedLeads}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-200">
                      {agent.conversionRate}%
                    </td>

                    <td className="py-3 px-3 text-right font-semibold text-slate-200">
                      {formatCurrency(agent.pipelineValue)}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-emerald-400">
                          {agent.completedFollowUps} done
                        </span>
                        {agent.overdueFollowUps > 0 && (
                          <span className="text-rose-400 bg-rose-500/10 px-1 rounded border border-rose-500/30 text-[10px]">
                            {agent.overdueFollowUps} overdue
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2.5 text-slate-400">
                        <span className="flex items-center gap-0.5" title="Calls">
                          <Phone className="h-3 w-3 text-blue-400" />
                          <span>{agent.calls}</span>
                        </span>
                        <span className="flex items-center gap-0.5" title="WhatsApp">
                          <MessageSquare className="h-3 w-3 text-emerald-400" />
                          <span>{agent.whatsApp}</span>
                        </span>
                        <span className="flex items-center gap-0.5" title="Emails">
                          <Mail className="h-3 w-3 text-amber-400" />
                          <span>{agent.emails}</span>
                        </span>
                        <span className="flex items-center gap-0.5" title="Meetings">
                          <Calendar className="h-3 w-3 text-violet-400" />
                          <span>{agent.meetings}</span>
                        </span>
                      </div>
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
