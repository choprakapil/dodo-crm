/**
 * Platform Global Search Service
 *
 * Powers Super Admin Ctrl+K command palette and global search across:
 * - Organizations (Companies)
 * - Users
 * - Subscription Plans
 * - Offerings (Products / Services)
 * - Dispositions
 */

import { prisma } from "@/lib/db";

export interface SearchResultItem {
  id: string;
  type: "ORGANIZATION" | "USER" | "PLAN" | "PRODUCT" | "SERVICE" | "DISPOSITION" | "PAGE";
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
}

export class PlatformSearchService {
  static async search(query: string): Promise<SearchResultItem[]> {
    const term = query.trim();
    if (!term) return [];

    const [companies, users, plans, offerings, dispositions] = await Promise.all([
      // 1. Companies
      prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: term } },
            { slug: { contains: term } },
            { email: { contains: term } },
          ],
        },
        include: { plan: true },
        take: 5,
      }),

      // 2. Users
      prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: term } },
            { email: { contains: term } },
            { phone: { contains: term } },
          ],
        },
        include: {
          company: { select: { name: true } },
          role: { select: { name: true } },
        },
        take: 5,
      }),

      // 3. Plans
      prisma.plan.findMany({
        where: {
          OR: [
            { name: { contains: term } },
            { description: { contains: term } },
          ],
        },
        take: 3,
      }),

      // 4. Offerings
      prisma.offering.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: term } },
            { code: { contains: term } },
          ],
        },
        include: { company: { select: { name: true } } },
        take: 5,
      }),

      // 5. Dispositions
      prisma.disposition.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: term } },
            { description: { contains: term } },
          ],
        },
        include: { company: { select: { name: true } } },
        take: 5,
      }),
    ]);

    const results: SearchResultItem[] = [];

    companies.forEach((c) => {
      results.push({
        id: `org-${c.id}`,
        type: "ORGANIZATION",
        title: c.name,
        subtitle: `Slug: /${c.slug} • Plan: ${c.plan?.name || "None"} • Status: ${c.status}`,
        badge: c.status,
        href: `/admin/companies/${c.id}`,
      });
    });

    users.forEach((u) => {
      results.push({
        id: `user-${u.id}`,
        type: "USER",
        title: u.name,
        subtitle: `${u.email} • ${u.role?.name || "User"} @ ${u.company?.name || "Unknown"}`,
        badge: u.status,
        href: `/admin/users?search=${encodeURIComponent(u.email)}`,
      });
    });

    plans.forEach((p) => {
      results.push({
        id: `plan-${p.id}`,
        type: "PLAN",
        title: `${p.name} Plan`,
        subtitle: `Seats: ${p.maxUsers} • Leads: ${p.maxLeads} • Tier: ${p.code}`,
        badge: p.code,
        href: `/admin/plans`,
      });
    });

    offerings.forEach((o) => {
      results.push({
        id: `off-${o.id}`,
        type: o.type === "PRODUCT" ? "PRODUCT" : "SERVICE",
        title: o.name,
        subtitle: `${o.type} • Base Price: ${o.currency} ${Number(o.defaultPrice)} @ ${o.company.name}`,
        badge: o.type,
        href: `/admin/products`,
      });
    });

    dispositions.forEach((d) => {
      results.push({
        id: `disp-${d.id}`,
        type: "DISPOSITION",
        title: d.name,
        subtitle: `Depth ${d.depth} Disposition @ ${d.company.name}`,
        badge: `D${d.depth}`,
        href: `/admin/dispositions`,
      });
    });

    return results;
  }
}
