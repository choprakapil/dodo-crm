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
    <div className="bg-white border border-slate-200/90 rounded-xl p-3 space-y-2.5 shadow-2xs">
      <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search leads by name, email, phone, company..."
              className="pl-8 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 h-8 text-xs focus-visible:ring-1 focus-visible:ring-indigo-500 shadow-2xs"
            />
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="h-8 px-3.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium border-transparent shadow-2xs"
          >
            Search
          </Button>
        </form>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 mr-0.5">
            <Filter className="h-3 w-3 text-indigo-600" />
            <span>Filters:</span>
          </div>

          {/* Status filter */}
          <select
            value={currentStatus}
            onChange={(e) => applyFilters({ statusId: e.target.value || null })}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-hidden focus:border-indigo-500 shadow-2xs"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={currentPriority}
            onChange={(e) => applyFilters({ priority: e.target.value || null })}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-hidden focus:border-indigo-500 shadow-2xs"
          >
            <option value="">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Source filter */}
          <select
            value={currentSource}
            onChange={(e) => applyFilters({ sourceId: e.target.value || null })}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-hidden focus:border-indigo-500 shadow-2xs"
          >
            <option value="">All Sources</option>
            {sources.map((src) => (
              <option key={src.id} value={src.id}>
                {src.name}
              </option>
            ))}
          </select>

          {/* Reset filter button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            >
              <X className="h-3 w-3 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
