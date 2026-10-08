import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { StatusSelector } from "@/components/leads/status-selector";
import { AssignSelector } from "@/components/leads/assign-selector";
import { EditLeadDialog } from "@/components/leads/edit-lead-dialog";
import { DeleteLeadDialog } from "@/components/leads/delete-lead-dialog";
import { LogActivityDialog } from "@/components/leads/log-activity-dialog";
import { ScheduleFollowUpDialog } from "@/components/leads/schedule-follow-up-dialog";
import { CallOutcomeDialog } from "@/components/leads/call-outcome-dialog";
import { AddNoteDialog } from "@/components/leads/add-note-dialog";
import { ConvertLeadDialog } from "@/components/leads/convert-lead-dialog";
import { LeadHistoryTimeline } from "@/components/leads/lead-history-timeline";
import { LeadCustomFieldsCard } from "@/components/leads/lead-custom-fields-card";
import { PriorityBadge } from "@/components/leads/lead-badge";
import { CommentThread } from "@/components/comments/comment-thread";
import { getTelUrl, getWhatsAppUrl, getMailtoUrl } from "@/lib/utils/contact-actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  DollarSign,
  Shield,
  Layers,
  MessageSquare,
  UserCheck,
  ChevronRight,
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
      currency: authContext?.company.currency || "INR",
      maximumFractionDigits: 0,
    }).format(num);
  }

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

  const telUrl = getTelUrl(lead.phone);
  const waUrl = getWhatsAppUrl(lead.phone);
  const mailtoUrl = getMailtoUrl(lead.email, `Follow-up: ${lead.name}`);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <Link
          href="/app/leads"
          className="flex items-center space-x-1 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Leads</span>
        </Link>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="text-slate-900 font-semibold truncate max-w-xs">{lead.name}</span>
        {lead.customerId && (
          <>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <Link
              href={`/app/customers/${lead.customerId}`}
              className="text-emerald-700 hover:text-emerald-800 transition flex items-center gap-1 font-semibold"
            >
              <UserCheck className="h-3 w-3" />
              <span>Customer Profile</span>
            </Link>
          </>
        )}
      </div>

      {/* Lead Record Header */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-2xs">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{lead.name}</h1>
            <PriorityBadge priority={lead.priority} />
            {lead.disposition && (
              <Badge
                style={{
                  backgroundColor: `${lead.disposition.color || "#4f46e5"}14`,
                  color: lead.disposition.color || "#4f46e5",
                  borderColor: `${lead.disposition.color || "#4f46e5"}30`,
                }}
                className="text-xs font-semibold border shadow-2xs"
              >
                {lead.disposition.name}
              </Badge>
            )}
            {lead.customerId && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold shadow-2xs">
                ✓ Converted Customer
              </Badge>
            )}
          </div>

          {/* Contact Details */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {lead.company && (
              <div className="flex items-center gap-1.5 text-slate-700">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium">{lead.company}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                <Phone className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-mono text-slate-800 font-medium">{lead.phone}</span>
                {telUrl && (
                  <a
                    href={telUrl}
                    title="Direct Call"
                    className="ml-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold"
                  >
                    Call
                  </a>
                )}
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Chat on WhatsApp"
                    className="ml-1 text-[11px] text-green-700 hover:text-green-800 font-semibold"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                <Mail className="h-3.5 w-3.5 text-sky-600" />
                <span className="text-slate-800 font-medium">{lead.email}</span>
                {mailtoUrl && (
                  <a
                    href={mailtoUrl}
                    title="Send Email"
                    className="ml-1 text-[11px] text-sky-700 hover:text-sky-800 font-semibold"
                  >
                    Email
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <StatusSelector
              leadId={lead.id}
              currentStatusId={lead.statusId}
              statuses={config.statuses}
            />
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-500 font-medium">Assign:</span>
            <AssignSelector
              leadId={lead.id}
              currentUserId={lead.assignedUserId}
              users={config.users}
            />
          </div>

          <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
            <ConvertLeadDialog
              leadId={lead.id}
              leadName={lead.name}
              phone={lead.phone}
              company={lead.company}
              disposition={lead.disposition}
              isAlreadyConverted={Boolean(lead.customerId)}
              existingCustomerId={lead.customerId}
            />
            <CallOutcomeDialog
              leadId={lead.id}
              leadName={lead.name}
              dispositions={config.dispositions}
              users={config.users}
              defaultAssigneeId={lead.assignedUserId}
            />
            <AddNoteDialog leadId={lead.id} leadName={lead.name} />
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
            <DeleteLeadDialog leadId={lead.id} leadName={lead.name} />
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Properties & Custom Fields */}
        <div className="space-y-5">
          <Card className="border-slate-200/90 bg-white shadow-2xs">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-slate-500" /> Deal &amp; Offering
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">Pipeline Value</span>
                <span className="text-lg font-bold text-emerald-600 font-mono tabular-nums">
                  {formatAmount(lead.amount)}
                </span>
              </div>
              {lead.offering && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 block mb-0.5">Target Offering</span>
                  <div className="text-xs font-medium text-slate-900">{lead.offering.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">Code: {lead.offering.code}</div>
                </div>
              )}
              {lead.source && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 block mb-0.5">Acquisition Channel</span>
                  <Badge variant="outline" className="border-slate-200 text-slate-700 bg-slate-50 text-xs font-medium">
                    {lead.source.name}
                  </Badge>
                </div>
              )}
              {lead.team && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 block mb-0.5">Assigned Team</span>
                  <div className="text-xs font-medium text-slate-900">{lead.team.name}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Fields Card */}
          <LeadCustomFieldsCard customFieldValues={lead.customFieldValues as any} />
        </div>

        {/* Right Column: Timeline & Internal Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Internal Collaboration Comments + @mentions */}
          <Card className="border-slate-200/90 bg-white shadow-2xs">
            <CardHeader className="pb-2 pt-4 px-4 border-b border-slate-100">
              <CardTitle className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-slate-500" /> Internal Notes &amp; Collaboration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <CommentThread entityType="LEAD" entityId={lead.id} />
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="border-slate-200/90 bg-white shadow-2xs">
            <CardHeader className="pb-2 pt-4 px-4 border-b border-slate-100">
              <CardTitle className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-500" /> Activity History Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <LeadHistoryTimeline
                statusHistories={lead.statusHistories as any}
                assignmentHistories={lead.assignmentHistories as any}
                activities={lead.activities as any}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
