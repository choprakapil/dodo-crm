"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Users, UserCheck, Clock, Settings, HelpCircle } from "lucide-react";

interface LeadNavProps {
  companyName: string;
  companySlug: string;
  userName: string;
  userEmail: string;
  roleName: string;
}

export function LeadNav({
  companyName,
  companySlug,
  userName,
  userEmail,
  roleName,
}: LeadNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/app",
      label: "Dashboard",
      icon: LayoutDashboard,
      active: pathname === "/app",
    },
    {
      href: "/app/customers",
      label: "Customers",
      icon: UserCheck,
      active: pathname.startsWith("/app/customers"),
    },
    {
      href: "/app/leads",
      label: "Enquiries",
      icon: Users,
      active: pathname.startsWith("/app/leads"),
    },
    {
      href: "/app/follow-ups",
      label: "Follow-ups",
      icon: Clock,
      active: pathname.startsWith("/app/follow-ups"),
    },
    {
      href: "/app/settings/users",
      label: "Settings",
      icon: Settings,
      active: pathname.startsWith("/app/settings"),
    },
    {
      href: "/app/help",
      label: "Help",
      icon: HelpCircle,
      active: pathname.startsWith("/app/help"),
    },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-6">
          <Link href="/app" className="flex items-center space-x-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition">
              <span className="text-white font-bold text-lg">U</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white tracking-tight group-hover:text-indigo-300 transition">
                  {companyName}
                </span>
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-[10px] px-1.5 py-0">
                  {companySlug}
                </Badge>
              </div>
            </div>
          </Link>

          <nav className="flex items-center space-x-1 pl-2 sm:border-l sm:border-slate-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    item.active
                      ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <div className="flex items-center justify-end space-x-2">
              <span className="text-xs font-semibold text-slate-200">{userName}</span>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300 font-mono text-[9px] px-1.5 py-0">
                {roleName}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400">{userEmail}</div>
          </div>
          <LogoutButton className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs h-8 px-3" />
        </div>
      </div>
    </header>
  );
}
