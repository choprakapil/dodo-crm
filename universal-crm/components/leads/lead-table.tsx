"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusSelector } from "./status-selector";
import { AssignSelector } from "./assign-selector";
import { EditLeadDialog } from "./edit-lead-dialog";
import { DeleteLeadDialog } from "./delete-lead-dialog";
import { PriorityBadge, PriorityLevel } from "./lead-badge";
import { getTelUrl, getWhatsAppUrl, getMailtoUrl } from "@/lib/utils/contact-actions";
import {
  ExternalLink,
  Mail,
  Phone,
  Building,
  MessageSquare,
  Building2,
  UserCheck,
  Users,
  Layers,
  Flame,
  Trash2,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import { useBulkSelection, BulkCheckbox, BulkActionToolbar, BulkAction } from "@/components/bulk";
import { LeadBulkCustomFieldsModal } from "./lead-bulk-custom-fields-modal";

export interface LeadItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  amount: number | string | null;
  priority: PriorityLevel;
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
  const router = useRouter();
  const [isBulkCustomFieldsOpen, setIsBulkCustomFieldsOpen] = useState(false);

  // Universal Bulk Selection Hook
  const {
    selectedIds,
    selectedItems,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection<LeadItem>({
    items: leads,
  });

  function formatAmount(val: number | string | null) {
    if (val === null || val === undefined) return "—";
    const num = typeof val === "string" ? parseFloat(val) : Number(val);
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(num);
  }

  // Declarative Bulk Actions for Leads
  const bulkActions: BulkAction<LeadItem>[] = useMemo(() => [
    {
      id: "assign_user",
      label: "Assign User",
      icon: UserCheck,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "select",
      confirmTitle: "Bulk Assign Leads to Rep",
      confirmDescription: `Reassign ${selectedCount} lead(s) to a specific team member.`,
      selectLabel: "Select Assignee",
      selectOptions: users.map((u) => ({
        label: u.name,
        value: u.id,
        description: u.email,
      })),
      onExecute: async (ids, extraData) => {
        const res = await fetch("/api/v1/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ASSIGN_USER",
            leadIds: ids,
            assignedUserId: extraData?.selectedValue || null,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "assign_team",
      label: "Assign Team",
      icon: Users,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "select",
      confirmTitle: "Bulk Assign Leads to Team",
      confirmDescription: `Reassign ${selectedCount} lead(s) to a department or squad.`,
      selectLabel: "Select Target Team",
      selectOptions: teams.map((t) => ({
        label: t.name,
        value: t.id,
      })),
      onExecute: async (ids, extraData) => {
        const res = await fetch("/api/v1/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ASSIGN_TEAM",
            leadIds: ids,
            teamId: extraData?.selectedValue || null,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "change_status",
      label: "Status",
      icon: Layers,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "select",
      confirmTitle: "Bulk Change Pipeline Stage",
      confirmDescription: `Move ${selectedCount} lead(s) to a new workflow status.`,
      selectLabel: "Select Target Status",
      selectOptions: statuses.map((s) => ({
        label: s.name,
        value: s.id,
      })),
      onExecute: async (ids, extraData) => {
        const res = await fetch("/api/v1/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CHANGE_STATUS",
            leadIds: ids,
            statusId: extraData?.selectedValue,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "change_priority",
      label: "Priority",
      icon: Flame,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "select",
      confirmTitle: "Bulk Change Priority",
      confirmDescription: `Update priority level for ${selectedCount} lead(s).`,
      selectLabel: "Select Priority Level",
      selectOptions: [
        { label: "LOW", value: "LOW", description: "Standard cold inquiry" },
        { label: "MEDIUM", value: "MEDIUM", description: "Standard warm inquiry" },
        { label: "HIGH", value: "HIGH", description: "High urgency opportunity" },
        { label: "URGENT", value: "URGENT", description: "Immediate turnaround required" },
      ],
      onExecute: async (ids, extraData) => {
        const res = await fetch("/api/v1/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CHANGE_PRIORITY",
            leadIds: ids,
            priority: extraData?.selectedValue,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "edit_custom_fields",
      label: "Custom Fields",
      icon: SlidersHorizontal,
      variant: "outline",
      onCustomClick: () => {
        setIsBulkCustomFieldsOpen(true);
      },
      onExecute: async () => ({
        success: true,
        total: 0,
        succeededCount: 0,
        failedCount: 0,
      }),
    },
    {
      id: "export",
      label: "Export CSV",
      icon: Download,
      variant: "outline",
      onExecute: async (ids) => {
        const headers = ["ID", "Lead Name", "Email", "Phone", "Company", "Deal Amount", "Priority", "Status", "Source", "Assignee", "Team", "Created Date"];
        const rows = selectedItems.map((l) => [
          `"${l.id}"`,
          `"${l.name.replace(/"/g, '""')}"`,
          `"${l.email || ""}"`,
          `"${l.phone || ""}"`,
          `"${l.company ? l.company.replace(/"/g, '""') : ""}"`,
          l.amount ?? "",
          `"${l.priority}"`,
          `"${l.status?.name || ""}"`,
          `"${l.source?.name || ""}"`,
          `"${l.assignedUser?.name || "Unassigned"}"`,
          `"${l.team?.name || ""}"`,
          `"${new Date(l.createdAt).toISOString()}"`,
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return {
          success: true,
          total: ids.length,
          succeededCount: ids.length,
          failedCount: 0,
        };
      },
    },
    {
      id: "delete",
      label: `Delete (${selectedCount})`,
      icon: Trash2,
      variant: "destructive",
      destructive: true,
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Delete Selected Leads",
      confirmDescription: `Soft-delete ${selectedCount} lead(s) from your pipeline.`,
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/leads/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "DELETE",
            leadIds: ids,
          }),
        });
        return await res.json();
      },
    },
  ], [selectedCount, selectedItems, users, teams, statuses]);

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white p-12 text-center shadow-2xs">
        <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-3 text-indigo-600">
          <Building2 className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">No leads found</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          No records match your active search or filters. Create a new lead or reset filters.
        </p>
        <div className="mt-4">
          <Link href="/app/leads">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 h-8 shadow-2xs"
            >
              Reset Filters
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Desktop & Tablet Table View */}
      <div className="hidden sm:block rounded-xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-4 w-10">
                  <BulkCheckbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={toggleSelectAll}
                    ariaLabel="Select all visible leads"
                  />
                </th>
                <th className="py-2.5 px-4">Lead &amp; Organization</th>
                <th className="py-2.5 px-4">Direct Contact</th>
                <th className="py-2.5 px-4">Stage / Status</th>
                <th className="py-2.5 px-4">Priority</th>
                <th className="py-2.5 px-4">Assignee</th>
                <th className="py-2.5 px-4">Deal Value</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {leads.map((lead) => {
                const isSelected = selectedIds.has(lead.id);
                const telUrl = getTelUrl(lead.phone);
                const waUrl = getWhatsAppUrl(lead.phone);
                const mailtoUrl = getMailtoUrl(lead.email, `Inquiry: ${lead.name}`);
                const leadInitials = lead.name
                  ? lead.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                  : "L";

                return (
                  <tr
                    key={lead.id}
                    className={`transition-colors group ${
                      isSelected ? "bg-indigo-50/60 hover:bg-indigo-50/80" : "hover:bg-slate-50/70"
                    }`}
                  >
                    {/* Multi-Select Checkbox */}
                    <td className="py-2.5 px-4">
                      <BulkCheckbox
                        checked={isSelected}
                        onChange={() => toggleSelect(lead.id)}
                        ariaLabel={`Select ${lead.name}`}
                      />
                    </td>

                    {/* Lead Name & Organization */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0 shadow-2xs">
                          {leadInitials}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <Link
                            href={`/app/leads/${lead.id}`}
                            className="font-semibold text-slate-900 group-hover:text-indigo-600 transition flex items-center gap-1.5"
                          >
                            <span className="truncate max-w-[190px]">{lead.name}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition text-slate-400 shrink-0" />
                          </Link>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            {lead.company ? (
                              <span className="flex items-center gap-1 truncate max-w-[140px]">
                                <Building className="h-3 w-3 text-slate-400 shrink-0" />
                                {lead.company}
                              </span>
                            ) : null}
                            {lead.source ? (
                              <Badge
                                variant="outline"
                                className="text-[9px] font-normal px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200"
                              >
                                {lead.source.name}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Direct Contact */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        {telUrl && (
                          <a
                            href={telUrl}
                            className="h-6 w-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition shadow-2xs"
                            title={`Call: ${lead.phone}`}
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                        {waUrl && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-6 w-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 transition shadow-2xs"
                            title={`WhatsApp: ${lead.phone}`}
                          >
                            <MessageSquare className="h-3 w-3" />
                          </a>
                        )}
                        {mailtoUrl && (
                          <a
                            href={mailtoUrl}
                            className="h-6 w-6 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition shadow-2xs"
                            title={`Email: ${lead.email}`}
                          >
                            <Mail className="h-3 w-3" />
                          </a>
                        )}
                        {!telUrl && !mailtoUrl && (
                          <span className="text-[11px] text-slate-400 italic font-mono">No direct contacts</span>
                        )}
                      </div>
                    </td>

                    {/* Stage / Status */}
                    <td className="py-2.5 px-4">
                      <StatusSelector
                        leadId={lead.id}
                        currentStatusId={lead.statusId}
                        statuses={statuses}
                      />
                    </td>

                    {/* Priority */}
                    <td className="py-2.5 px-4">
                      <PriorityBadge priority={lead.priority} />
                    </td>

                    {/* Assignee */}
                    <td className="py-2.5 px-4">
                      <AssignSelector
                        leadId={lead.id}
                        currentUserId={lead.assignedUserId}
                        users={users}
                      />
                    </td>

                    {/* Deal Value */}
                    <td className="py-2.5 px-4 font-medium text-slate-800 tabular-nums">
                      {formatAmount(lead.amount)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditLeadDialog
                          lead={{
                            id: lead.id,
                            name: lead.name,
                            email: lead.email,
                            phone: lead.phone,
                            company: lead.company,
                            amount: lead.amount,
                            priority: lead.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                            sourceId: lead.sourceId,
                            teamId: lead.teamId,
                          }}
                          sources={sources}
                          teams={teams}
                        />
                        <DeleteLeadDialog leadId={lead.id} leadName={lead.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universal Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        selectedIds={Array.from(selectedIds)}
        actions={bulkActions}
        onClearSelection={clearSelection}
        onActionComplete={() => {
          router.refresh();
        }}
        entityName="leads"
      />

      {/* Bulk Custom Fields Editor Modal */}
      <LeadBulkCustomFieldsModal
        isOpen={isBulkCustomFieldsOpen}
        selectedIds={Array.from(selectedIds)}
        onClose={() => setIsBulkCustomFieldsOpen(false)}
        onComplete={() => {
          clearSelection();
          router.refresh();
        }}
      />
    </div>
  );
}
