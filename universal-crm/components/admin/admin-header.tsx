"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  LogOut,
  ChevronRight,
  Shield,
  Activity,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminHeaderProps {
  onOpenCommandPalette: () => void;
}

export function AdminHeader({ onOpenCommandPalette }: AdminHeaderProps) {
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

  // Generate breadcrumbs from pathname
  const pathSegments = pathname.split("/").filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const url = "/" + pathSegments.slice(0, index + 1).join("/");
    let label = segment.replace(/-/g, " ");
    label = label.charAt(0).toUpperCase() + label.slice(1);
    if (segment === "admin") label = "Console";
    return { url, label };
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-2xs">
      {/* Brand & Breadcrumbs */}
      <div className="flex items-center gap-6">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-md shadow-indigo-600/20">
            D
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight text-slate-900">
                DODO CRM
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/70 uppercase tracking-wider">
                Platform
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Super Admin Console</span>
          </div>
        </Link>

        {/* Dynamic Breadcrumbs */}
        <nav className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 pl-4 border-l border-slate-200">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.url} className="flex items-center gap-1.5">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
                {isLast ? (
                  <span className="font-semibold text-slate-900">{crumb.label}</span>
                ) : (
                  <Link href={crumb.url} className="hover:text-slate-900 transition">
                    {crumb.label}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Center Command Palette Trigger */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-indigo-300 text-slate-400 hover:text-slate-600 transition shadow-2xs group"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
            <span className="text-xs">Quick search platform records...</span>
          </div>
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-white rounded border border-slate-200 shadow-2xs">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Right User & Actions */}
      <div className="flex items-center gap-4">
        {/* System Health Status Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>System Healthy</span>
        </div>

        {/* Operator Profile */}
        <div className="hidden sm:flex flex-col text-right">
          <span className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">
            {adminEmail}
          </span>
          <span className="text-[10px] font-mono text-indigo-600 font-semibold uppercase tracking-wider">
            SUPER ADMIN ROLE
          </span>
        </div>

        {/* Sign Out Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium"
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" />
          <span>Sign Out</span>
        </Button>
      </div>
    </header>
  );
}
