"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Filter } from "lucide-react";

interface FilterProps {
  statuses: Array<{ id: string; name: string; color: string }>;
  sources: Array<{ id: string; name: string }>;
}

export function LeadFilters({ statuses, sources }: FilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("statusId") || "";
  const currentSource = searchParams.get("sourceId") || "";
  const currentPriority = searchParams.get("priority") || "";

  const [searchTerm, setSearchTerm] = useState(currentSearch);

  function applyFilters(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    
    // Always reset page to 1 when changing filters
    params.set("page", "1");

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    startTransition(() => {
      router.push(`/app/leads?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    applyFilters({ search: searchTerm.trim() || null });
  }

  function handleReset() {
    setSearchTerm("");
    startTransition(() => {
      router.push("/app/leads");
    });
  }

  const hasActiveFilters = Boolean(
    currentSearch || currentStatus || currentSource || currentPriority
  );

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3 backdrop-blur">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search input form */}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search leads by name, email, phone, company..."
              className="pl-9 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-500 h-9 text-xs focus-visible:ring-indigo-500"
            />
          </div>
          <Button
            type="submit"
            disabled={isPending}
            variant="secondary"
            className="h-9 px-4 text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30"
          >
            Search
          </Button>
        </form>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1">
            <Filter className="h-3.5 w-3.5" />
            <span>Filters:</span>
          </div>

          {/* Status filter */}
          <select
            value={currentStatus}
            onChange={(e) => applyFilters({ statusId: e.target.value || null })}
            className="h-9 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Source filter */}
          <select
            value={currentSource}
            onChange={(e) => applyFilters({ sourceId: e.target.value || null })}
            className="h-9 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Sources</option>
            {sources.map((src) => (
              <option key={src.id} value={src.id}>
                {src.name}
              </option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={currentPriority}
            onChange={(e) => applyFilters({ priority: e.target.value || null })}
            className="h-9 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Clear button */}
          {hasActiveFilters && (
            <Button
              onClick={handleReset}
              variant="ghost"
              size="sm"
              className="h-9 px-2 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
