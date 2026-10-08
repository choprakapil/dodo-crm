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
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, SKU, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus-visible:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setTypeFilter("ALL")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                typeFilter === "ALL"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter("PRODUCT")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                typeFilter === "PRODUCT"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setTypeFilter("SERVICE")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                typeFilter === "SERVICE"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Services
            </button>
          </div>

          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveFilter("ALL")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeFilter === "ALL"
                  ? "bg-slate-200 text-slate-800 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveFilter("ACTIVE")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeFilter === "ACTIVE"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveFilter("INACTIVE")}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                activeFilter === "INACTIVE"
                  ? "bg-slate-200 text-slate-800 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Catalog Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="text-sm text-slate-500">Loading catalog...</span>
          </div>
        ) : offerings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
            <Package className="h-10 w-10 text-slate-300" />
            <p className="text-base font-medium text-slate-800">No offerings found</p>
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white mt-2 text-xs shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Offering
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
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
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {offerings.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      {item.description && (
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {item.code || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {item.type === "PRODUCT" ? (
                        <Badge
                          variant="outline"
                          className="bg-sky-50 border-sky-200 text-sky-700 flex items-center space-x-1 w-fit font-normal text-[11px]"
                        >
                          <ShoppingBag className="h-3 w-3 text-sky-600" />
                          <span>Product</span>
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-purple-50 border-purple-200 text-purple-700 flex items-center space-x-1 w-fit font-normal text-[11px]"
                        >
                          <Wrench className="h-3 w-3 text-purple-600" />
                          <span>Service</span>
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {item.currency} {Number(item.defaultPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4">
                      {item.allowSalesPriceOverride ? (
                        <span className="inline-flex items-center text-emerald-700 text-[11px] font-medium">
                          <Unlock className="h-3 w-3 mr-1 text-emerald-600" />
                          Allowed
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-700 text-[11px] font-medium">
                          <Lock className="h-3 w-3 mr-1 text-amber-600" />
                          Locked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.isActive ? (
                        <Badge className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-normal text-[11px]">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                          Active
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 border border-slate-200 text-slate-600 font-normal text-[11px]">
                          <XCircle className="h-3 w-3 mr-1 text-slate-400" />
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
                          className="h-8 px-2 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Edit offering"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(item)}
                          disabled={actionInProgressId === item.id}
                          className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
