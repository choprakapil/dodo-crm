"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Clock,
  UserCheck,
} from "lucide-react";

export function MobileBottomNav() {
  const pathname = usePathname();

  const items = [
    {
      href: "/app",
      label: "Dashboard",
      icon: LayoutDashboard,
      active: pathname === "/app",
    },
    {
      href: "/app/leads",
      label: "Leads",
      icon: Users,
      active: pathname.startsWith("/app/leads"),
    },
    {
      href: "/app/pipeline",
      label: "Pipeline",
      icon: Kanban,
      active: pathname.startsWith("/app/pipeline"),
    },
    {
      href: "/app/follow-ups",
      label: "Follow-ups",
      icon: Clock,
      active: pathname.startsWith("/app/follow-ups"),
    },
    {
      href: "/app/customers",
      label: "Customers",
      icon: UserCheck,
      active: pathname.startsWith("/app/customers"),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg"
      aria-label="Mobile Bottom Navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-1 rounded-xl transition ${
              item.active
                ? "text-indigo-600 font-semibold"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <div className={`p-1 rounded-lg ${item.active ? "bg-indigo-50 text-indigo-600" : ""}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
