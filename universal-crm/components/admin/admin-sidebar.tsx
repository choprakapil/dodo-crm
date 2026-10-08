"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Building2,
  PlusCircle,
  Layers,
  Sliders,
  Shield,
  Users,
  UserCheck,
  ShieldCheck,
  Package,
  Wrench,
  GitBranch,
  FileCode,
  ScrollText,
  Settings,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

interface NavGroup {
  label: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    exact?: boolean;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "PLATFORM",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/system", label: "System Health", icon: Activity },
    ],
  },
  {
    label: "ORGANIZATIONS",
    items: [
      { href: "/admin/companies", label: "All Organizations", icon: Building2 },
      { href: "/admin/companies/new", label: "Create Organization", icon: PlusCircle, badge: "Wizard" },
    ],
  },
  {
    label: "PLANS & BILLING",
    items: [
      { href: "/admin/plans", label: "Subscription Plans", icon: Layers },
      { href: "/admin/features", label: "Feature Matrix", icon: Sliders },
      { href: "/admin/limits", label: "Platform Limits", icon: Shield },
      { href: "/admin/usage", label: "Fleet Telemetry", icon: Activity },
    ],
  },
  {
    label: "USERS & ACCESS",
    items: [
      { href: "/admin/users", label: "Global Users", icon: Users },
      { href: "/admin/roles", label: "Roles & Matrix", icon: UserCheck },
      { href: "/admin/security", label: "Platform Security", icon: ShieldCheck },
    ],
  },
  {
    label: "CRM CONFIGURATION",
    items: [
      { href: "/admin/products", label: "Product Catalog", icon: Package },
      { href: "/admin/services", label: "Service Offerings", icon: Wrench },
      { href: "/admin/dispositions", label: "Hierarchical Dispositions", icon: GitBranch },
      { href: "/admin/custom-fields", label: "Custom Fields", icon: FileCode },
    ],
  },
  {
    label: "GOVERNANCE",
    items: [
      { href: "/admin/audit-logs", label: "Platform Audit Trail", icon: ScrollText },
      { href: "/admin/settings", label: "Platform Settings", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupLabel]: !prev[groupLabel],
    }));
  };

  const isItemActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] flex flex-col justify-between select-none">
      <div className="p-4 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const isCollapsed = collapsedGroups[group.label];
          return (
            <div key={group.label} className="space-y-1.5">
              {/* Group Header with Collapse Toggle */}
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider transition"
              >
                <span>{group.label}</span>
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Group Items */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isItemActive(item.href, item.exact);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                          active
                            ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100/80 shadow-2xs"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon
                            className={`h-4 w-4 shrink-0 ${
                              active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-100/70 text-indigo-700 uppercase tracking-wider">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Operator Isolation Banner */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 mb-1">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span>Super Admin Gateway</span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Air-gapped platform console. Dual-session cookie boundaries enforced.
        </p>
      </div>
    </aside>
  );
}
