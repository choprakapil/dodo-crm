import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { StatusSelector } from "@/components/leads/status-selector";
import { AssignSelector } from "@/components/leads/assign-selector";
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog";
import { DeleteLeadDialog } from "@/components/leads/delete-lead-dialog";
import { LogActivityDialog } from "@/components/leads/log-activity-dialog";
import { ScheduleFollowUpDialog } from "@/components/leads/schedule-follow-up-dialog";
import { CallOutcomeDialog } from "@/components/leads/call-outcome-dialog";
import { LeadHistoryTimeline } from "@/components/leads/lead-history-timeline";
import { LeadCustomFieldsCard } from "@/components/leads/lead-custom-fields-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  DollarSign,
  Shield,
  Layers,
} from "lucide-react";

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { id } = await params;

  let lead;
  try {
    lead = await LeadService.getLeadById(authContext, id);
  } catch {
    notFound();
  }

  const config = await LeadService.getLeadConfig(authContext);

  function formatAmount(val: unknown) {
    if (val === null || val === undefined) return "—";
    const num = Number(val);
    if (isNaN(num)) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: authContext?.company.currency || "USD",
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

  // Serialize lead for child client components
  const serializedLead = {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    amount: lead.amount ? Number(lead.amount) : null,
    priority: lead.priority,
    sourceId: lead.sourceId,
    teamId: lead.teamId,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <LeadNav
        companyName={authContext.company.name}
        companySlug={authContext.company.slug}
        userName={authContext.user.name}
        userEmail={authContext.user.email}
        roleName={authContext.role.name}
      />

      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* Breadcrumb / Back button */}
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <Link
            href="/app/leads"
            className="flex items-center space-x-1 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Leads</span>
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200 font-medium truncate max-w-xs">{lead.name}</span>
        </div>

        {/* Lead Summary Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 backdrop-blur flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{lead.name}</h1>
              {getPriorityBadge(lead.priority)}
              {lead.disposition && (
                <Badge
                  style={{
                    backgroundColor: `${lead.disposition.color || "#6366f1"}25`,
                    color: lead.disposition.color || "#6366f1",
                    borderColor: `${lead.disposition.color || "#6366f1"}50`,
                  }}
                  className="text-xs font-medium border"
                >
                  {lead.disposition.name}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {lead.company && (
                <div className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-slate-500" />
                  <span>{lead.company}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-500" />
                  <span>{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  <span>{lead.phone}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Status:</span>
              <StatusSelector
                leadId={lead.id}
                currentStatusId={lead.statusId}
                statuses={config.statuses}
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Assignee:</span>
              <AssignSelector
                leadId={lead.id}
                currentUserId={lead.assignedUserId}
                users={config.users}
              />
            </div>

            <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-800">
              <CallOutcomeDialog
                leadId={lead.id}
                leadName={lead.name}
                dispositions={config.dispositions}
                users={config.users}
                defaultAssigneeId={lead.assignedUserId}
              />
              <LogActivityDialog leadId={lead.id} leadName={lead.name} />
              <ScheduleFollowUpDialog
                leadId={lead.id}
                leadName={lead.name}
                users={config.users}
                defaultAssigneeId={lead.assignedUserId}
              />
              <EditLeadDialog
                lead={serializedLead}
                sources={config.sources}
                teams={config.teams}
              />
              <DeleteLeadDialog
                leadId={lead.id}
                leadName={lead.name}
                redirectAfterDelete={true}
              />
            </div>
          </div>
        </div>

        {/* 2-Column Details & History Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Metadata Cards */}
          <div className="space-y-6">
            {/* Value & Pipeline Card */}
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-400" /> Opportunity Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Deal Value:</span>
                  <span className="font-mono text-base font-semibold text-emerald-400">
                    {formatAmount(lead.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Lead Source:</span>
                  <span className="text-slate-200 font-medium">
                    {lead.source?.name || "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Assigned Team:</span>
                  <span className="text-slate-200 font-medium">
                    {lead.team?.name || "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Priority:</span>
                  <span>{getPriorityBadge(lead.priority)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Custom Fields Card */}
            <LeadCustomFieldsCard customFieldValues={lead.customFieldValues} />

            {/* Ownership & Tenant Isolation Metadata */}
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-400" /> Tenant Scope & Auditing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Tenant ID:</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[150px]">
                    {lead.companyId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Lead ID:</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate max-w-[150px]">
                    {lead.id}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Created At:</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {new Date(lead.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-400">Last Updated:</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {new Date(lead.updatedAt).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Timeline & Activity History */}
          <div className="lg:col-span-2">
            <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" /> Lead History & Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LeadHistoryTimeline
                  statusHistories={lead.statusHistories}
                  assignmentHistories={lead.assignmentHistories}
                  activities={lead.activities}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
