"use client";

import { useEffect, useState, useMemo } from "react";
import { Wrench, Search, RefreshCw, Loader2, CheckCircle2, XCircle, Trash2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useBulkSelection, BulkCheckbox, BulkActionToolbar, BulkAction } from "@/components/bulk";

export default function PlatformServicesPage() {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {
    selectedIds,
    selectedItems,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection({
    items: offerings,
  });

  const loadOfferings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/crm-config/offerings?type=SERVICE`);
      const json = await res.json();
      if (json.success) {
        setOfferings(json.data || []);
      }
    } catch {
      toast.error("Failed to load services.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOfferings();
  }, []);

  const bulkActions: BulkAction[] = useMemo(() => [
    {
      id: "activate",
      label: "Activate",
      icon: CheckCircle2,
      variant: "outline",
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/crm-config/offerings/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ACTIVATE",
            offeringIds: ids,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "deactivate",
      label: "Deactivate",
      icon: XCircle,
      variant: "warning",
      requiresConfirmation: true,
      confirmTitle: "Deactivate Selected Services",
      confirmDescription: `Deactivate ${selectedCount} service package(s).`,
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/crm-config/offerings/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "DEACTIVATE",
            offeringIds: ids,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "export",
      label: "Export CSV",
      icon: Download,
      variant: "outline",
      onExecute: async (ids) => {
        const headers = ["ID", "Service Name", "Organization", "Base Price", "Currency", "Status"];
        const rows = selectedItems.map((off) => [
          `"${off.id}"`,
          `"${off.name.replace(/"/g, '""')}"`,
          `"${off.company?.name || ""}"`,
          off.basePrice,
          `"${off.currency}"`,
          off.isActive ? "Active" : "Inactive",
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `services_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return {
          success: true,
          total: ids.length,
          succeededCount: ids.length,
          failedCount: 0,
        };
      },
    },
    {
      id: "delete",
      label: `Delete (${selectedCount})`,
      icon: Trash2,
      variant: "destructive",
      destructive: true,
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Delete Selected Services",
      confirmDescription: `Delete ${selectedCount} service package(s). Note: Services with linked deal histories will be automatically archived instead to protect ledger integrity.`,
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/crm-config/offerings/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "DELETE",
            offeringIds: ids,
          }),
        });
        return await res.json();
      },
    },
  ], [selectedCount, selectedItems]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Service Offerings Management
          </h1>
          <p className="text-xs text-slate-500">
            Multi-tenant consulting, implementation, and support service packages.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadOfferings} className="h-8 text-xs border-slate-200">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3 w-10">
                  <BulkCheckbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={toggleSelectAll}
                    ariaLabel="Select all visible services"
                  />
                </th>
                <th className="px-4 py-3">Service Name</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Base Price</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
                    Loading services...
                  </td>
                </tr>
              ) : offerings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400">
                    No services found.
                  </td>
                </tr>
              ) : (
                offerings.map((off) => {
                  const isSelected = selectedIds.has(off.id);
                  return (
                    <tr
                      key={off.id}
                      className={`transition-colors ${
                        isSelected ? "bg-indigo-50/60 hover:bg-indigo-50/80" : "hover:bg-slate-50/60"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <BulkCheckbox
                          checked={isSelected}
                          onChange={() => toggleSelect(off.id)}
                          ariaLabel={`Select ${off.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{off.name}</td>
                      <td className="px-4 py-3 font-medium text-slate-600">{off.company?.name}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {off.currency} {off.basePrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            off.isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {off.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <BulkActionToolbar
        selectedCount={selectedCount}
        selectedIds={Array.from(selectedIds)}
        actions={bulkActions}
        onClearSelection={clearSelection}
        onActionComplete={loadOfferings}
        entityName="services"
      />
    </div>
  );
}
