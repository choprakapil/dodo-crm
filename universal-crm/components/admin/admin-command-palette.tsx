"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  User,
  Layers,
  Package,
  Wrench,
  GitBranch,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";
import { SearchResultItem } from "@/lib/services/platform-search.service";

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminCommandPalette({ isOpen, onClose }: AdminCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/admin/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.success) {
          setResults(json.data || []);
          setSelectedIndex(0);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      onClose();
      router.push(item.href);
    },
    [onClose, router]
  );

  const getIcon = (type: SearchResultItem["type"]) => {
    switch (type) {
      case "ORGANIZATION":
        return <Building2 className="h-4 w-4 text-indigo-600" />;
      case "USER":
        return <User className="h-4 w-4 text-emerald-600" />;
      case "PLAN":
        return <Layers className="h-4 w-4 text-amber-600" />;
      case "PRODUCT":
        return <Package className="h-4 w-4 text-sky-600" />;
      case "SERVICE":
        return <Wrench className="h-4 w-4 text-violet-600" />;
      case "DISPOSITION":
        return <GitBranch className="h-4 w-4 text-rose-600" />;
      default:
        return <Search className="h-4 w-4 text-slate-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/40 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-slate-100 px-4 py-3.5">
          <Search className="h-5 w-5 text-slate-400 shrink-0 mr-3" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search organizations, users, plans, offerings, dispositions..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0 ml-2" />
          ) : (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {query.trim() && results.length === 0 && !loading && (
            <div className="py-12 text-center text-xs text-slate-400">
              No matching platform records found for &ldquo;{query}&rdquo;.
            </div>
          )}

          {!query.trim() && (
            <div className="p-4 space-y-3">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Quick Navigation
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => {
                    onClose();
                    router.push("/admin/companies");
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 transition text-left"
                >
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <span className="font-medium">All Organizations</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push("/admin/users");
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 transition text-left"
                >
                  <User className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">Global Users</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push("/admin/plans");
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 transition text-left"
                >
                  <Layers className="h-4 w-4 text-amber-600" />
                  <span className="font-medium">Plans & Limits</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push("/admin/audit-logs");
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-indigo-50 hover:border-indigo-200 text-slate-700 transition text-left"
                >
                  <Search className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">Platform Audit Logs</span>
                </button>
              </div>
            </div>
          )}

          {results.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                  isSelected ? "bg-indigo-50 text-indigo-900 border border-indigo-100" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 truncate">{item.subtitle}</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-2 bg-slate-50 flex items-center justify-between text-[11px] text-slate-400">
          <span>Tip: Press ESC to close</span>
          <span className="font-mono">DODO CRM Platform Console</span>
        </div>
      </div>
    </div>
  );
}
