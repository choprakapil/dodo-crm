"use server";

import { getAuthContext } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";

export interface SearchResultItem {
  id: string;
  type: "lead" | "customer" | "deal" | "task";
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  url: string;
  metadata?: Record<string, any>;
}

export interface GlobalSearchResult {
  success: boolean;
  query: string;
  totalCount: number;
  results: {
    leads: SearchResultItem[];
    customers: SearchResultItem[];
    deals: SearchResultItem[];
    tasks: SearchResultItem[];
  };
  error?: string;
}

/**
 * Server Action: Global CRM Search
 *
 * Enforces:
 * 1. Strict Tenant Isolation (WHERE companyId = ctx.company.id on every query)
 * 2. Soft-delete exclusion (deletedAt: null)
 * 3. MySQL 8.0+ compatible indexing
 * 4. Bounded pagination (take: 5 per domain)
 * 5. Multi-entity search across Leads, Customers, Deals, and Tasks
 */
export async function globalCrmSearch(query: string): Promise<GlobalSearchResult> {
  try {
    const authContext = await getAuthContext();
    if (!authContext) {
      throw new ForbiddenError("Not authenticated");
    }

    const companyId = authContext.company.id;
    const term = query?.trim();

    if (!term || term.length < 2) {
      return {
        success: true,
        query: term || "",
        totalCount: 0,
        results: { leads: [], customers: [], deals: [], tasks: [] },
      };
    }

    // Parallel tenant-isolated queries
    const [leads, customers, deals, tasks] = await Promise.all([
      // 1. Leads
      prisma.lead.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { name: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } },
            { company: { contains: term } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: {
          status: { select: { id: true, name: true, color: true } },
          assignedUser: { select: { id: true, name: true } },
        },
      }),

      // 2. Customers
      prisma.customer.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { name: { contains: term } },
            { displayName: { contains: term } },
            { companyName: { contains: term } },
            { phones: { some: { rawPhone: { contains: term } } } },
            { emails: { some: { email: { contains: term } } } },
          ],
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: {
          phones: { select: { rawPhone: true, normalizedPhone: true, isPrimary: true } },
          emails: { select: { email: true, isPrimary: true } },
          _count: { select: { enquiries: true } },
        },
      }),

      // 3. Deals (Leads with monetary opportunity or offering)
      prisma.lead.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { amount: { not: null } },
            { quotedPrice: { not: null } },
            { offeringId: { not: null } },
          ],
          AND: [
            {
              OR: [
                { name: { contains: term } },
                { company: { contains: term } },
                { offering: { name: { contains: term } } },
              ],
            },
          ],
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
        include: {
          offering: { select: { name: true } },
          status: { select: { name: true, color: true } },
          customer: { select: { name: true } },
        },
      }),

      // 4. Tasks
      prisma.task.findMany({
        where: {
          companyId,
          OR: [
            { title: { contains: term } },
            { description: { contains: term } },
          ],
        },
        take: 5,
        orderBy: { dueAt: "asc" },
        include: {
          lead: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Format mapped results
    const mappedLeads: SearchResultItem[] = leads.map((l) => ({
      id: l.id,
      type: "lead",
      title: l.name,
      subtitle: [l.company, l.phone, l.email].filter(Boolean).join(" • ") || undefined,
      badge: l.status?.name || l.priority,
      badgeColor: l.status?.color || undefined,
      url: `/app/leads/${l.id}`,
      metadata: {
        amount: l.amount ? Number(l.amount) : undefined,
        assignedTo: l.assignedUser?.name,
      },
    }));

    const mappedCustomers: SearchResultItem[] = customers.map((c) => {
      const primaryPhone = c.phones.find((p) => p.isPrimary)?.rawPhone || c.phones[0]?.rawPhone;
      const primaryEmail = c.emails.find((e) => e.isPrimary)?.email || c.emails[0]?.email;
      return {
        id: c.id,
        type: "customer",
        title: c.name,
        subtitle: [c.companyName, primaryPhone, primaryEmail].filter(Boolean).join(" • ") || undefined,
        badge: `${c._count.enquiries} ${c._count.enquiries === 1 ? "Deal" : "Deals"}`,
        badgeColor: "#6366f1",
        url: `/app/customers/${c.id}`,
        metadata: {
          enquiriesCount: c._count.enquiries,
        },
      };
    });

    const mappedDeals: SearchResultItem[] = deals.map((d) => {
      const val = d.amount || d.quotedPrice;
      const valStr = val ? `₹${Number(val).toLocaleString("en-IN")}` : "Open Deal";
      return {
        id: d.id,
        type: "deal",
        title: d.name,
        subtitle: [d.offering?.name, d.company, d.customer?.name ? `Customer: ${d.customer.name}` : null]
          .filter(Boolean)
          .join(" • ") || undefined,
        badge: valStr,
        badgeColor: "#10b981",
        url: `/app/leads/${d.id}`,
        metadata: {
          stage: d.status?.name,
          offering: d.offering?.name,
        },
      };
    });

    const mappedTasks: SearchResultItem[] = tasks.map((t) => ({
      id: t.id,
      type: "task",
      title: t.title,
      subtitle: t.lead ? `Lead: ${t.lead.name}` : t.description || undefined,
      badge: t.dueAt ? new Date(t.dueAt).toLocaleDateString() : t.status,
      badgeColor: t.status === "OVERDUE" ? "#f43f5e" : "#eab308",
      url: t.leadId ? `/app/leads/${t.leadId}` : "/app/follow-ups",
      metadata: {
        status: t.status,
        priority: t.priority,
      },
    }));

    const totalCount =
      mappedLeads.length + mappedCustomers.length + mappedDeals.length + mappedTasks.length;

    return {
      success: true,
      query: term,
      totalCount,
      results: {
        leads: mappedLeads,
        customers: mappedCustomers,
        deals: mappedDeals,
        tasks: mappedTasks,
      },
    };
  } catch (err: any) {
    console.error("globalCrmSearch error:", err);
    return {
      success: false,
      query: query || "",
      totalCount: 0,
      results: { leads: [], customers: [], deals: [], tasks: [] },
      error: err.message || "Search failed",
    };
  }
}
