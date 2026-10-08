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
    <div className="border border-slate-200 bg-white mb-6 px-3 rounded-xl shadow-2xs">
      <div className="flex items-center space-x-1.5 overflow-x-auto py-2.5 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                item.active
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
