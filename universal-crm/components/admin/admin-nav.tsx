"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Layers,
  ScrollText,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminEmail, setAdminEmail] = useState<string>("superadmin@universalcrm.com");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/v1/admin/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.superAdmin?.email) {
          setAdminEmail(data.data.superAdmin.email);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/v1/admin/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch {
      router.push("/admin/login");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: LayoutDashboard,
      active: pathname === "/admin",
    },
    {
      href: "/admin/companies",
      label: "Companies",
      icon: Building2,
      active: pathname.startsWith("/admin/companies"),
    },
    {
      href: "/admin/plans",
      label: "Plans & Quotas",
      icon: Layers,
      active: pathname.startsWith("/admin/plans"),
    },
    {
      href: "/admin/audit-logs",
      label: "Platform Audit",
      icon: ScrollText,
      active: pathname.startsWith("/admin/audit-logs"),
    },
    {
      href: "/admin/security",
      label: "Security",
      icon: ShieldCheck,
      active: pathname.startsWith("/admin/security"),
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-slate-900 text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Badge */}
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-sm">
              UC
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-white">
                Universal CRM
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-300">
                Platform Console
              </span>
            </div>
          </Link>

          {/* Nav Items */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    item.active
                      ? "bg-slate-800 text-white shadow-inner"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium text-slate-200">{adminEmail}</p>
            <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
              SUPER ADMIN
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            <span className="text-xs">Sign Out</span>
          </Button>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="flex border-t border-slate-800 px-4 py-2 md:hidden">
        <div className="flex w-full overflow-x-auto space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium ${
                  item.active ? "bg-slate-800 text-white" : "text-slate-400"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
