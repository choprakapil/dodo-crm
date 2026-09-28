"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatusSelector } from "./status-selector";
import { AssignSelector } from "./assign-selector";
import { EditLeadDialog } from "./edit-lead-dialog";
import { DeleteLeadDialog } from "./delete-lead-dialog";
import { ExternalLink, Mail, Phone, Building } from "lucide-react";

interface LeadItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  amount: number | string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  statusId: string | null;
  sourceId: string | null;
  assignedUserId: string | null;
  teamId: string | null;
  createdAt: string | Date;
  status: { id: string; name: string; color: string } | null;
  source: { id: string; name: string } | null;
  assignedUser: { id: string; name: string; email: string } | null;
  team: { id: string; name: string } | null;
}

interface LeadTableProps {
  leads: LeadItem[];
  currency: string;
  statuses: Array<{ id: string; name: string; color: string }>;
  sources: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  teams: Array<{ id: string; name: string }>;
}

export function LeadTable({
  leads,
  currency,
  statuses,
  sources,
  users,
  teams,
}: LeadTableProps) {
  function formatAmount(val: number | string | null) {
    if (val === null || val === undefined) return "—";
    const num = typeof val === "string" ? parseFloat(val) : Number(val);
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(num);
  }

  function getPriorityBadge(priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT") {
    switch (priority) {
      case "URGENT":
        return <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[10px]">Urgent</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">High</Badge>;
      case "MEDIUM":
        return <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 text-[10px]">Medium</Badge>;
      case "LOW":
        return <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px]">Low</Badge>;
    }
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center backdrop-blur">
        <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3 text-indigo-400">
          <Building className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-white">No leads found</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
          No leads match your active search or filter criteria. Try adjusting your filters or create a new lead.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
            <tr>
              <th className="py-3 px-4">Lead</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4">Assignee</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Value</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="hover:bg-slate-800/30 transition-colors group"
              >
                {/* Lead Name & Contact */}
                <td className="py-3 px-4">
                  <div className="space-y-0.5">
                    <Link
                      href={`/app/leads/${lead.id}`}
                      className="font-semibold text-white group-hover:text-indigo-400 transition flex items-center gap-1.5"
                    >
                      <span>{lead.name}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition text-slate-400" />
                    </Link>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                      {lead.company && (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3 text-slate-500" />
                          <span>{lead.company}</span>
                        </span>
                      )}
                      {lead.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-500" />
                          <span>{lead.email}</span>
                        </span>
                      )}
                      {lead.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-500" />
                          <span>{lead.phone}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Status Dropdown */}
                <td className="py-3 px-4">
                  <StatusSelector
                    leadId={lead.id}
                    currentStatusId={lead.statusId}
                    statuses={statuses}
                  />
                </td>

                {/* Source Badge */}
                <td className="py-3 px-4">
                  {lead.source ? (
                    <Badge variant="outline" className="border-slate-800 text-slate-300 bg-slate-900/60 text-[10px]">
                      {lead.source.name}
                    </Badge>
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">—</span>
                  )}
                </td>

                {/* Assignee Dropdown */}
                <td className="py-3 px-4">
                  <AssignSelector
                    leadId={lead.id}
                    currentUserId={lead.assignedUserId}
                    users={users}
                  />
                </td>

                {/* Priority */}
                <td className="py-3 px-4">
                  {getPriorityBadge(lead.priority)}
                </td>

                {/* Amount */}
                <td className="py-3 px-4 font-mono font-medium text-slate-200">
                  {formatAmount(lead.amount)}
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <Link
                      href={`/app/leads/${lead.id}`}
                      className="p-1.5 rounded text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition"
                      title="View Lead Details"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    <EditLeadDialog
                      lead={lead}
                      sources={sources}
                      teams={teams}
                    />
                    <DeleteLeadDialog
                      leadId={lead.id}
                      leadName={lead.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
