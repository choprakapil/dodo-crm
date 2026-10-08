"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  UserCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  Loader2,
  X,
  CornerDownLeft,
} from "lucide-react";
import { globalCrmSearch, SearchResultItem } from "@/lib/actions/search-actions";

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: GlobalSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    leads: SearchResultItem[];
    customers: SearchResultItem[];
    deals: SearchResultItem[];
    tasks: SearchResultItem[];
  }>({
    leads: [],
    customers: [],
    deals: [],
    tasks: [],
  });
  const [totalCount, setTotalCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({ leads: [], customers: [], deals: [], tasks: [] });
      setTotalCount(0);
      return;
    }

    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setLoading(true);
        try {
          const res = await globalCrmSearch(query);
          if (res.success) {
            setResults(res.results);
            setTotalCount(res.totalCount);
          }
        } catch (err) {
          console.error("Search error:", err);
        } finally {
          setLoading(false);
        }
      } else {
        setResults({ leads: [], customers: [], deals: [], tasks: [] });
        setTotalCount(0);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, open]);

  // Focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  function handleSelect(url: string) {
    onOpenChange(false);
    router.push(url);
  }

  const hasAnyResults = totalCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border border-slate-200 text-slate-900 p-0 overflow-hidden shadow-2xl rounded-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search CRM</DialogTitle>
        </DialogHeader>

        {/* Search input bar */}
        <div className="flex items-center px-4 border-b border-slate-200 bg-slate-50/60">
          <Search className="h-4 w-4 text-slate-400 shrink-0 mr-3" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search leads, customers, deals, or tasks... (min 2 chars)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 h-12 px-0"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-indigo-600 mr-2 shrink-0" />}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-slate-400 hover:text-slate-600 transition"
              title="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {/* Empty / Intro state */}
          {query.trim().length < 2 && (
            <div className="py-12 text-center text-slate-400">
              <Search className="h-7 w-7 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-medium text-slate-600">Type at least 2 characters to search across the CRM</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Fast indexed search across prospects, customers, opportunities, and tasks
              </p>
            </div>
          )}

          {/* No results found */}
          {query.trim().length >= 2 && !loading && !hasAnyResults && (
            <div className="py-12 text-center text-slate-500">
              <p className="text-sm font-medium text-slate-800">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1">
                Check your spelling or search by phone, email, or company.
              </p>
            </div>
          )}

          {/* Leads section */}
          {results.leads.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-indigo-600" /> Leads ({results.leads.length})
                </span>
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                {results.leads.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.url)}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-900 group-hover:text-indigo-600 transition">
                          {item.title}
                        </span>
                        {item.badge && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-600 bg-slate-50"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers section */}
          {results.customers.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Customers ({results.customers.length})
                </span>
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                {results.customers.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.url)}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-900 group-hover:text-indigo-600 transition">
                          {item.title}
                        </span>
                        {item.badge && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-600 bg-slate-50"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deals section */}
          {results.deals.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-violet-600" /> Deals & Opportunities ({results.deals.length})
                </span>
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                {results.deals.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.url)}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-900 group-hover:text-indigo-600 transition">
                          {item.title}
                        </span>
                        {item.badge && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-700 font-mono bg-slate-50 tabular-nums"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks section */}
          {results.tasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" /> Tasks & Follow-ups ({results.tasks.length})
                </span>
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                {results.tasks.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.url)}
                    className="p-2.5 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-900 group-hover:text-indigo-600 transition">
                          {item.title}
                        </span>
                        {item.badge && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-600 font-mono bg-slate-50"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      {item.subtitle && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>Press <kbd className="px-1.5 py-0.5 bg-white rounded text-slate-600 border border-slate-200 font-mono text-[10px] shadow-2xs">ESC</kbd> to close</span>
            <span><kbd className="px-1.5 py-0.5 bg-white rounded text-slate-600 border border-slate-200 font-mono text-[10px] shadow-2xs">Ctrl+K</kbd> to toggle</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Navigate</span>
            <CornerDownLeft className="h-3 w-3" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
