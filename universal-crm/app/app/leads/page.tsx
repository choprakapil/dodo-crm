import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { leadListQuerySchema } from "@/lib/validations/lead";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadPagination } from "@/components/leads/lead-pagination";
import Link from "next/link";
import { CreateLeadDialog } from "@/components/leads/create-lead-dialog";
import { LeadExportButton } from "@/components/leads/lead-export-button";
import { Users, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LeadsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const rawParams = await searchParams;
  const queryObj: Record<string, string> = {};
  for (const [key, val] of Object.entries(rawParams)) {
    if (typeof val === "string") {
      queryObj[key] = val;
    } else if (Array.isArray(val) && val[0]) {
      queryObj[key] = val[0];
    }
  }

  const parsedQuery = leadListQuerySchema.parse(queryObj);

  // Fetch leads and configuration in parallel
  const [leadResult, config] = await Promise.all([
    LeadService.listLeads(authContext, parsedQuery),
    LeadService.getLeadConfig(authContext),
  ]);

  const totalLeadsCount = leadResult.pagination?.total ?? leadResult.data.length;

  const serializedLeads = JSON.parse(JSON.stringify(leadResult.data)).map((lead: any) => ({
    ...lead,
    amount: lead.amount ? Number(lead.amount) : null,
    defaultPriceAtCreation: lead.defaultPriceAtCreation ? Number(lead.defaultPriceAtCreation) : null,
    quotedPrice: lead.quotedPrice ? Number(lead.quotedPrice) : null,
    createdAt: new Date(lead.createdAt).toISOString(),
  }));

  const serializedConfig = JSON.parse(JSON.stringify(config));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 max-w-7xl mx-auto">
      {/* Workspace Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Lead Management
            </h1>
            <Badge variant="outline" className="border-slate-200 text-slate-700 bg-slate-50 text-xs font-semibold">
              {totalLeadsCount} records
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Prospects, active inquiries, and qualified leads for <span className="font-medium text-slate-700">{authContext.company.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <LeadExportButton />
          <Link href="/app/leads/import">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-200 bg-white text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 h-8 shadow-2xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1 text-slate-500" />
              Import
            </Button>
          </Link>
          <CreateLeadDialog
            statuses={serializedConfig.statuses}
            sources={serializedConfig.sources}
            users={serializedConfig.users}
            teams={serializedConfig.teams}
          />
          <Link href="/app/leads/new">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium h-8 shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <LeadFilters statuses={serializedConfig.statuses} sources={serializedConfig.sources} />

      {/* Data Table */}
      <LeadTable
        leads={serializedLeads}
        currency={authContext.company.currency || "INR"}
        statuses={serializedConfig.statuses}
        sources={serializedConfig.sources}
        users={serializedConfig.users}
        teams={serializedConfig.teams}
      />

      {/* Pagination Controls */}
      {leadResult.pagination && (
        <LeadPagination {...leadResult.pagination} />
      )}
    </div>
  );
}
