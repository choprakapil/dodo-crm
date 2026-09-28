"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Shield,
  Building,
  Key,
  Sliders,
  History,
  UserCheck,
  Package,
  PhoneCall,
} from "lucide-react";

export function SettingsNav() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/app/settings/users",
      label: "Users",
      icon: Users,
      active: pathname.startsWith("/app/settings/users"),
    },
    {
      href: "/app/settings/teams",
      label: "Teams",
      icon: UserCheck,
      active: pathname.startsWith("/app/settings/teams"),
    },
    {
      href: "/app/settings/roles",
      label: "Roles & Permissions",
      icon: Shield,
      active: pathname.startsWith("/app/settings/roles"),
    },
    {
      href: "/app/settings/offerings",
      label: "Products & Services",
      icon: Package,
      active: pathname.startsWith("/app/settings/offerings"),
    },
    {
      href: "/app/settings/dispositions",
      label: "Dispositions",
      icon: PhoneCall,
      active: pathname.startsWith("/app/settings/dispositions"),
    },
    {
      href: "/app/settings/company",
      label: "Company",
      icon: Building,
      active: pathname.startsWith("/app/settings/company"),
    },
    {
      href: "/app/settings/custom-fields",
      label: "Custom Fields",
      icon: Sliders,
      active: pathname.startsWith("/app/settings/custom-fields"),
    },
    {
      href: "/app/settings/security",
      label: "Security & Sessions",
      icon: Key,
      active: pathname.startsWith("/app/settings/security"),
    },
    {
      href: "/app/settings/audit-logs",
      label: "Audit Logs",
      icon: History,
      active: pathname.startsWith("/app/settings/audit-logs"),
    },
  ];

  return (
    <div className="border-b border-slate-800 bg-slate-900/40 mb-8 -mt-6 -mx-4 sm:-mx-8 px-4 sm:px-8">
      <div className="flex items-center space-x-1 overflow-x-auto py-2.5 no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                item.active
                  ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
