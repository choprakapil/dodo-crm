"use client";

import { useEffect, useState, useMemo } from "react";
import { GitBranch, RefreshCw, Loader2, Download, Trash2, Power, PowerOff, GitFork } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  useBulkSelection,
  BulkCheckbox,
  BulkActionToolbar,
  BulkAction,
} from "@/components/bulk";
import { DispositionHierarchyModal } from "@/components/settings/disposition-hierarchy-modal";

export default function PlatformDispositionsPage() {
  const [dispositions, setDispositions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hierarchy management modal state
  const [hierarchyModalOpen, setHierarchyModalOpen] = useState(false);
  const [selectedDispositionForHierarchy, setSelectedDispositionForHierarchy] = useState<any | null>(null);
  const [hierarchyAction, setHierarchyAction] = useState<"delete" | "deactivate" | "manage">("manage");

  const loadDispositions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/crm-config/dispositions`);
      const json = await res.json();
      if (json.success) {
        setDispositions(json.data || []);
      }
    } catch {
      toast.error("Failed to load dispositions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenHierarchy = (disp: any, action: "delete" | "deactivate" | "manage") => {
    setSelectedDispositionForHierarchy(disp);
    setHierarchyAction(action);
    setHierarchyModalOpen(true);
  };


  useEffect(() => {
    loadDispositions();
  }, []);

  const {
    selectedIds,
    selectedItems,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection<any>({
    items: dispositions,
    getItemId: (d) => d.id,
  });

  const bulkActions: BulkAction<any>[] = useMemo(() => [
    {
      id: "activate",
      label: "Activate",
      icon: Power,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Activate Selected Dispositions",
      confirmDescription: "Selected dispositions will be enabled across CRM call logging and stage transitions.",
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/crm-config/dispositions/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ACTIVATE", dispositionIds: ids }),
        });
        const data = await res.json();
        loadDispositions();
        return data;
      },
    },
    {
      id: "deactivate",
      label: "Deactivate",
      icon: PowerOff,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Deactivate Selected Dispositions",
      confirmDescription: "Deactivated dispositions will be hidden from new call logs but preserved for past history.",
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/crm-config/dispositions/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "DEACTIVATE", dispositionIds: ids }),
        });
        const data = await res.json();
        loadDispositions();
        return data;
      },
    },
    {
      id: "export",
      label: "Export CSV",
      icon: Download,
      variant: "outline",
      onExecute: async (ids) => {
        const selected = dispositions.filter((d) => ids.includes(d.id));
        const csvRows = [
          ["ID", "Outcome Name", "Organization", "Level", "Follow-up Rule", "Allows Close", "Allows Convert", "Active"].join(","),
          ...selected.map((d) =>
            [
              `"${d.id}"`,
              `"${d.name.replace(/"/g, '""')}"`,
              `"${d.company?.name ? d.company.name.replace(/"/g, '""') : "Global"}"`,
              `"Level ${d.level}"`,
              `"${d.followUpMandatory ? "Mandatory" : "Optional"}"`,
              `"${d.allowsClose ? "Yes" : "No"}"`,
              `"${d.allowsConvert ? "Yes" : "No"}"`,
              `"${d.isActive !== false ? "Active" : "Inactive"}"`,
            ].join(",")
          ),
        ];

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `dispositions_export_${new Date().toISOString().split("T")[0]}.csv`);
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
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      destructive: true,
      requiresConfirmation: true,
      confirmType: "typed_delete",
      confirmTitle: "Delete Selected Dispositions",
      confirmDescription: "Dispositions with child sub-outcomes are protected by hierarchy rules and cannot be deleted. Dispositions attached to active leads will be safely archived.",
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/crm-config/dispositions/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "DELETE", dispositionIds: ids }),
        });
        const data = await res.json();
        loadDispositions();
        return data;
      },
    },
  ], [dispositions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hierarchical Dispositions Management
          </h1>
          <p className="text-xs text-slate-500">
            3-tier call outcome taxonomy, mandatory follow-up gatekeeping, and pipeline conversion permissions.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadDispositions} className="h-8 text-xs border-slate-200">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="w-10 px-4 py-3">
                  <BulkCheckbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all dispositions on this page"
                  />
                </th>
                <th className="px-4 py-3">Disposition Outcome</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Hierarchy Level</th>
                <th className="px-4 py-3">Follow-up Rule</th>
                <th className="px-4 py-3">Close Permission</th>
                <th className="px-4 py-3">Conversion Permission</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
                    Loading hierarchical dispositions...
                  </td>
                </tr>
              ) : dispositions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-xs text-slate-400">
                    No dispositions configured.
                  </td>
                </tr>
              ) : (
                dispositions.map((d) => {
                  const isSelected = selectedIds.has(d.id);
                  const childCount = d.children?.length ?? (dispositions.filter((item) => item.parentId === d.id).length);

                  return (
                    <tr
                      key={d.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isSelected ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <td className="w-10 px-4 py-3">
                        <BulkCheckbox
                          checked={isSelected}
                          onChange={() => toggleSelect(d.id)}
                          aria-label={`Select ${d.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span>{d.name}</span>
                        {childCount > 0 && (
                          <Badge
                            variant="outline"
                            onClick={() => handleOpenHierarchy(d, "manage")}
                            className="text-[10px] text-indigo-600 border-indigo-200 bg-indigo-50/50 cursor-pointer hover:bg-indigo-100/60 transition-colors gap-1"
                          >
                            <GitFork className="h-2.5 w-2.5" />
                            {childCount} sub-outcome{childCount > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-600">{d.company?.name || "Global"}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-700">Level {d.level}</td>
                      <td className="px-4 py-3">
                        {d.followUpMandatory ? (
                          <span className="text-amber-700 font-semibold">Mandatory Next Step</span>
                        ) : (
                          <span className="text-slate-400">Optional</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{d.allowsClose ? "✓ Permitted" : "—"}</td>
                      <td className="px-4 py-3">{d.allowsConvert ? "✓ Permitted" : "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            d.isActive !== false
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {d.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenHierarchy(d, "manage")}
                            className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            title="Manage Child Hierarchy"
                          >
                            <GitBranch className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenHierarchy(d, "delete")}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete Disposition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Universal Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        selectedIds={Array.from(selectedIds)}
        actions={bulkActions}
        onClearSelection={clearSelection}
        onActionComplete={() => {
          clearSelection();
          loadDispositions();
        }}
        entityName="dispositions"
      />

      {/* Platform Hierarchy Management & Reassignment Modal */}
      <DispositionHierarchyModal
        open={hierarchyModalOpen}
        onOpenChange={setHierarchyModalOpen}
        disposition={selectedDispositionForHierarchy}
        allDispositions={dispositions}
        actionType={hierarchyAction}
        isAdminMode={true}
        onHierarchyUpdated={loadDispositions}
      />
    </div>
  );
}

