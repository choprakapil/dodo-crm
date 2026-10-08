import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Kanban, Plus, Users } from "lucide-react";

export const metadata = {
  title: "Pipeline & Deals | Dodo CRM",
  description: "Visual Kanban deal pipeline management and stage transitions",
};

export default async function PipelinePage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const companyId = authContext.company.id;

  // 1. Fetch tenant pipeline statuses in display order
  const statuses = await prisma.leadStatus.findMany({
    where: { companyId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      displayOrder: true,
    },
  });

  // 2. Fetch active leads for tenant
  const rawLeads = await prisma.lead.findMany({
    where: {
      companyId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      company: true,
      phone: true,
      email: true,
      amount: true,
      priority: true,
      statusId: true,
      createdAt: true,
      assignedUser: {
        select: { id: true, name: true },
      },
      disposition: {
        select: {
          id: true,
          name: true,
          color: true,
          allowsClose: true,
          allowsConvert: true,
        },
      },
    },
  });

  // 3. Serialize leads for client component
  const leadsSerialized = rawLeads.map((lead) => ({
    ...lead,
    amount: lead.amount ? Number(lead.amount) : null,
    createdAt: lead.createdAt.toISOString(),
  }));

  const totalPipelineValue = leadsSerialized.reduce(
    (acc, l) => acc + (l.amount ? Number(l.amount) : 0),
    0
  );

  const formattedTotalValue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: authContext.company.currency || "INR",
    maximumFractionDigits: 0,
  }).format(totalPipelineValue);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-[1600px] mx-auto">
      {/* Pipeline Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Sales Pipeline
            </h1>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-xs font-semibold tabular-nums shadow-2xs">
              {formattedTotalValue} total value
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Drag and drop deals across stages. Disposition gatekeeping business rules are strictly enforced.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/app/leads">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 h-8 shadow-2xs"
            >
              <Users className="h-3.5 w-3.5 mr-1 text-slate-500" />
              <span>Table View</span>
            </Button>
          </Link>
          <Link href="/app/leads/new">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-medium h-8 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>New Lead</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Kanban Board Container */}
      <KanbanBoard
        statuses={statuses}
        initialLeads={leadsSerialized}
        currency={authContext.company.currency || "INR"}
      />
    </div>
  );
}
