"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  Loader2,
  AlertCircle,
  Wrench,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OfferingFormDialog, OfferingData } from "./offering-form-dialog";

export function OfferingsWorkspace() {
  const [offerings, setOfferings] = useState<OfferingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PRODUCT" | "SERVICE">("ALL");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<OfferingData | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const fetchOfferings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (activeFilter === "ACTIVE") params.set("isActive", "true");
      if (activeFilter === "INACTIVE") params.set("isActive", "false");
      params.set("limit", "100");

      const res = await fetch(`/api/v1/offerings?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to load products and services");
      }

      setOfferings(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, activeFilter]);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  const handleToggleActive = async (offering: OfferingData) => {
    if (!offering.id) return;
    setActionInProgressId(offering.id);
    try {
      const res = await fetch(`/api/v1/offerings/${offering.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !offering.isActive }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to update offering");
      }
      fetchOfferings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating offering");
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDelete = async (offering: OfferingData) => {
    if (!offering.id) return;
    if (
      !confirm(
        `Are you sure you want to archive "${offering.name}"? Historical enquiries referencing it will remain intact.`
      )
    ) {
      return;
    }

    setActionInProgressId(offering.id);
    try {
      const res = await fetch(`/api/v1/offerings/${offering.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to archive offering");
      }
      fetchOfferings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error archiving offering");
    } finally {
      setActionInProgressId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Package className="h-6 w-6 text-indigo-400" />
            <span>Products & Services</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure your offering catalog, default prices, and salesperson price override rules.
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedOffering(null);
            setDialogOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Offering
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, SKU, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-md border border-slate-800 text-xs">
            <button
              onClick={() => setTypeFilter("ALL")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                typeFilter === "ALL"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter("PRODUCT")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                typeFilter === "PRODUCT"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setTypeFilter("SERVICE")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                typeFilter === "SERVICE"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Services
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-md border border-slate-800 text-xs">
            <button
              onClick={() => setActiveFilter("ALL")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeFilter === "ALL"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter("ACTIVE")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeFilter === "ACTIVE"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveFilter("INACTIVE")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeFilter === "INACTIVE"
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/30 border border-red-800 rounded-lg text-red-300 text-sm flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Catalog Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            <span className="text-sm">Loading catalog...</span>
          </div>
        ) : offerings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <Package className="h-10 w-10 text-slate-600" />
            <p className="text-base font-medium text-slate-300">No offerings found</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {search || typeFilter !== "ALL" || activeFilter !== "ALL"
                ? "Try adjusting your search filters."
                : "Create your first product or service offering to begin quoting enquiries."}
            </p>
            {(!search && typeFilter === "ALL" && activeFilter === "ALL") && (
              <Button
                onClick={() => {
                  setSelectedOffering(null);
                  setDialogOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white mt-2 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Offering
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Offering</th>
                  <th className="py-3.5 px-4">SKU / Code</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Default Price</th>
                  <th className="py-3.5 px-4">Price Override</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {offerings.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                      {item.code || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {item.type === "PRODUCT" ? (
                        <Badge
                          variant="outline"
                          className="bg-sky-950/40 border-sky-800 text-sky-300 flex items-center space-x-1 w-fit font-normal text-[11px]"
                        >
                          <ShoppingBag className="h-3 w-3" />
                          <span>Product</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-purple-950/40 border-purple-800 text-purple-300 flex items-center space-x-1 w-fit font-normal text-[11px]"
                        >
                          <Wrench className="h-3 w-3" />
                          <span>Service</span>
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-100">
                      {item.currency} {Number(item.defaultPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      {item.allowSalesPriceOverride ? (
                        <span className="inline-flex items-center text-emerald-400 text-[11px]">
                          <Unlock className="h-3 w-3 mr-1 text-emerald-500" />
                          Allowed
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-400 text-[11px]">
                          <Lock className="h-3 w-3 mr-1 text-amber-500" />
                          Locked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.isActive ? (
                        <Badge className="bg-emerald-950/60 border border-emerald-800 text-emerald-400 hover:bg-emerald-950 font-normal text-[11px]">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800 border border-slate-700 text-slate-400 font-normal text-[11px]">
                          <XCircle className="h-3 w-3 mr-1 text-slate-500" />
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(item)}
                          disabled={actionInProgressId === item.id}
                          className="h-8 px-2 text-[11px] text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                          title={item.isActive ? "Deactivate offering" : "Activate offering"}
                        >
                          {item.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedOffering(item);
                            setDialogOpen(true);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                          title="Edit offering"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          disabled={actionInProgressId === item.id}
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                          title="Archive offering"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OfferingFormDialog
        offering={selectedOffering}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={fetchOfferings}
      />
    </div>
  );
}
