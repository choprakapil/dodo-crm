"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { GlobalSearchDialog } from "@/components/search/global-search-dialog";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Building2,
  Clock,
  Settings,
  HelpCircle,
  Search,
  Plus,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { CrmGuidedTour } from "@/components/tour/crm-guided-tour";

interface WorkspaceShellProps {
  companyName: string;
  companySlug: string;
  userName: string;
  userEmail: string;
  roleName: string;
  children: React.ReactNode;
}

export function WorkspaceShell({
  companyName,
  companySlug,
  userName,
  userEmail,
  roleName,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
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
      href: "/app/customers",
      label: "Customers",
      icon: Building2,
      active: pathname.startsWith("/app/customers"),
    },
    {
      href: "/app/follow-ups",
      label: "Follow-ups & Tasks",
      icon: Clock,
      active: pathname.startsWith("/app/follow-ups"),
    },
  ];

  const configItems = [
    {
      href: "/app/settings/users",
      label: "Team & Roles",
      icon: UserCheck,
      active: pathname.startsWith("/app/settings/users"),
    },
    {
      href: "/app/settings/dispositions",
      label: "Stages & Dispositions",
      icon: Settings,
      active: pathname.startsWith("/app/settings/dispositions"),
    },
    {
      href: "/app/help",
      label: "Help & Docs",
      icon: HelpCircle,
      active: pathname.startsWith("/app/help"),
    },
  ];

  // Helper for user avatar initials
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  // Breadcrumb / view name helper
  const getViewTitle = () => {
    if (pathname === "/app") return "Dashboard";
    if (pathname.startsWith("/app/leads/new")) return "Create Lead";
    if (pathname.startsWith("/app/leads/import")) return "Import Leads";
    if (pathname.startsWith("/app/leads/")) return "Lead Record";
    if (pathname.startsWith("/app/leads")) return "Leads";
    if (pathname.startsWith("/app/pipeline")) return "Sales Pipeline";
    if (pathname.startsWith("/app/customers/")) return "Customer 360";
    if (pathname.startsWith("/app/customers")) return "Customers";
    if (pathname.startsWith("/app/follow-ups")) return "Follow-ups & Tasks";
    if (pathname.startsWith("/app/settings")) return "Settings";
    if (pathname.startsWith("/app/help")) return "Help & Documentation";
    return "Workspace";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* ==================================================================== */}
      {/* DESKTOP SIDEBAR (>= 768px)                                           */}
      {/* ==================================================================== */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-slate-200 bg-white sticky top-0 h-screen select-none z-30 shadow-xs">
        {/* Workspace Brand / Tenant Header */}
        <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2.5 min-w-0 group">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:bg-indigo-700 transition">
              D
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 tracking-tight truncate group-hover:text-indigo-600 transition">
                {companyName}
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate">
                {companySlug} &bull; CRM V2
              </div>
            </div>
          </Link>
        </div>

        {/* Global Search Bar Button */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-xs text-slate-500 hover:text-slate-800 transition group shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition" />
              <span>Search...</span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-mono text-slate-500 shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Quick Create Action */}
        <div className="px-3 pt-2">
          <Link href="/app/leads/new" className="block">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Lead</span>
            </button>
          </Link>
        </div>

        {/* Main Workspace Navigation Links */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <div className="space-y-0.5">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    item.active
                      ? "bg-indigo-50 text-indigo-700 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${item.active ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="space-y-0.5">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Settings & Docs
            </div>
            {configItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    item.active
                      ? "bg-indigo-50 text-indigo-700 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${item.active ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Bottom User Profile Strip */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[11px] font-semibold text-indigo-700 shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-900 truncate">{userName}</div>
                <div className="text-[10px] text-slate-500 truncate">{roleName}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <NotificationBell className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md" />
              <LogoutButton className="h-7 px-2 text-[11px] bg-transparent hover:bg-slate-200/60 text-slate-500 hover:text-slate-900 border-none shadow-none" />
            </div>
          </div>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* MOBILE SLIDE-OVER DRAWER (< 768px)                                   */}
      {/* ==================================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-white border-r border-slate-200 flex flex-col h-full z-10 p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                  D
                </div>
                <span className="text-xs font-semibold text-slate-900">{companyName}</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                      item.active ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${item.active ? "text-indigo-600" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs font-medium text-slate-800">{userName}</div>
              <LogoutButton className="h-7 px-2 text-xs" />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MAIN VIEWPORT WRAPPER                                                */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Contextual Header Bar */}
        <header className="h-12 border-b border-slate-200 bg-white/95 backdrop-blur-xs sticky top-0 z-20 px-3 sm:px-6 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Contextual Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 hidden sm:inline">{companyName}</span>
              <ChevronRight className="h-3 w-3 text-slate-300 hidden sm:inline" />
              <span className="font-semibold text-slate-900 tracking-tight">{getViewTitle()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Trigger for Top Bar */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition md:hidden"
            >
              <Search className="h-3.5 w-3.5" />
            </button>

            {/* Quick Tour Trigger */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("dodo:open-tour"))}
              className="hidden lg:flex items-center gap-1 h-7 px-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100/80 text-[11px] font-medium transition shadow-2xs"
              title="Start Interactive Guided Tour"
            >
              <Sparkles className="h-3 w-3 text-indigo-600" />
              <span>CRM Tour</span>
            </button>

            {/* In-App Notifications */}
            <NotificationBell className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg" />

            {/* Contextual Quick Create */}
            <Link href="/app/leads/new" className="hidden sm:inline-block">
              <button
                type="button"
                className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs"
              >
                <Plus className="h-3 w-3" />
                <span>Lead</span>
              </button>
            </Link>
          </div>
        </header>

        {/* Workspace Content View */}
        <main className="flex-1 bg-[#F8FAFC] pb-20 md:pb-8">
          {children}
        </main>
      </div>

      {/* ==================================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR (< 768px)                               */}
      {/* ==================================================================== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] py-1 px-1 rounded-lg transition ${
                item.active ? "text-indigo-600 font-semibold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Global Command Palette Modal */}
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Interactive CRM Guided Tour */}
      <CrmGuidedTour userRole={roleName} userId={userName} />
    </div>
  );
}
