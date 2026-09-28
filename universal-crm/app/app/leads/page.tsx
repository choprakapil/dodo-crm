import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { leadListQuerySchema } from "@/lib/validations/lead";
import { LeadNav } from "@/components/leads/lead-nav";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadPagination } from "@/components/leads/lead-pagination";
import Link from "next/link";
import { CreateLeadDialog } from "@/components/leads/create-lead-dialog";
import { LeadExportButton } from "@/components/leads/lead-export-button";
import { Users, Upload, HelpCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // Parallel fetch leads and tenant lead configuration
  const [leadResult, config] = await Promise.all([
    LeadService.listLeads(authContext, parsedQuery),
    LeadService.getLeadConfig(authContext),
  ]);

  // Serialize leads to plain JSON-safe objects (amounts converted to number/null)
  const leadsSerialized = (leadResult.data as Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    amount: unknown;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    statusId: string | null;
    sourceId: string | null;
    assignedUserId: string | null;
    teamId: string | null;
    createdAt: Date | string;
    status: { id: string; name: string; color: string } | null;
    source: { id: string; name: string } | null;
    assignedUser: { id: string; name: string; email: string } | null;
    team: { id: string; name: string } | null;
  }>).map((lead) => ({
    ...lead,
    amount: lead.amount ? Number(lead.amount) : null,
    createdAt: new Date(lead.createdAt).toISOString(),
  }));

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
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Users className="h-4 w-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Lead Management</span>
                <Link
                  href="/app/help?article=leads"
                  className="text-slate-500 hover:text-indigo-400 transition"
                  title="Lead Management Help Guide"
                >
                  <HelpCircle className="h-4 w-4" />
                </Link>
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Manage and track potential sales opportunities for {authContext.company.name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LeadExportButton />
            <Link href="/app/leads/import">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-800 text-xs text-slate-300 hover:text-white"
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Import Leads
              </Button>
            </Link>
            <CreateLeadDialog
              statuses={config.statuses}
              sources={config.sources}
              users={config.users}
              teams={config.teams}
            />
            <Link href="/app/leads/new">
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Enquiry
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters and Search */}
        <LeadFilters statuses={config.statuses} sources={config.sources} />

        {/* Leads Table */}
        <LeadTable
          leads={leadsSerialized}
          currency={authContext.company.currency}
          statuses={config.statuses}
          sources={config.sources}
          users={config.users}
          teams={config.teams}
        />

        {/* Pagination */}
        <LeadPagination
          page={leadResult.pagination.page}
          pageSize={leadResult.pagination.pageSize}
          total={leadResult.pagination.total}
          totalPages={leadResult.pagination.totalPages}
          hasNextPage={leadResult.pagination.hasNextPage}
          hasPreviousPage={leadResult.pagination.hasPreviousPage}
        />
      </main>
    </div>
  );
}
