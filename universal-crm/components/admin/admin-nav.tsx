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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white text-slate-900 shadow-2xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Badge */}
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-sm text-xs">
              DODO
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-slate-900">
                DODO CRM
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
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
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    item.active
                      ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
            <p className="text-xs font-medium text-slate-800">{adminEmail}</p>
            <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
              SUPER ADMIN
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            <span className="text-xs">Sign Out</span>
          </Button>
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="flex border-t border-slate-100 px-4 py-2 md:hidden bg-slate-50">
        <div className="flex w-full overflow-x-auto space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  item.active
                    ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100"
                    : "text-slate-600 hover:bg-slate-100"
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
