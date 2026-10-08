import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { FollowUpService } from "@/lib/services/follow-up.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { FollowUpWorkspace } from "@/components/follow-ups/follow-up-workspace";
import Link from "next/link";
import { Clock, HelpCircle } from "lucide-react";

interface FollowUpsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    status?: string;
    priority?: string;
    dueFilter?: string;
    search?: string;
  }>;
}

export default async function FollowUpsPage({ searchParams }: FollowUpsPageProps) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const limit = sp.limit ? parseInt(sp.limit, 10) : 20;
  const dueFilter = (sp.dueFilter as "all" | "today" | "upcoming" | "overdue" | "completed" | "cancelled") || "all";
  const search = sp.search || undefined;

  const result = await FollowUpService.listFollowUps(authContext, {
    page,
    limit,
    dueFilter,
    search,
    sortBy: "dueAt",
    sortOrder: "asc",
  });

  const serializedItems = (result.data as Array<{
    id: string;
    title: string;
    description: string | null;
    dueAt: Date | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    status: "PENDING" | "COMPLETED" | "CANCELLED";
    completedAt: Date | null;
    lead: {
      id: string;
      name: string;
      company: string | null;
      phone: string | null;
      email: string | null;
    } | null;
    assignedUser: {
      id: string;
      name: string;
      email: string;
    } | null;
    creator: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : null,
    priority: item.priority,
    status: item.status,
    completedAt: item.completedAt ? new Date(item.completedAt).toISOString() : null,
    lead: item.lead,
    assignedUser: item.assignedUser,
    creator: item.creator,
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
              Follow-up Workspace
            </h1>
            <Link
              href="/app/help?article=follow-ups"
              className="text-slate-400 hover:text-slate-600 transition"
              title="Follow-ups Help Guide"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage scheduled calls, meetings, reminders, and follow-ups across your pipeline.
          </p>
        </div>
      </div>

      {/* Workspace Table & Filters */}
      <FollowUpWorkspace
        initialItems={serializedItems}
        pagination={{
          page: result.pagination.page,
          pageSize: result.pagination.pageSize,
          totalCount: result.pagination.total,
          totalPages: result.pagination.totalPages,
        }}
        currentDueFilter={dueFilter}
        currentSearch={search}
      />
    </div>
  );
}
