"use client";

import { useEffect, useState } from "react";
import { FileCode, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PlatformCustomFieldsPage() {
  const [fields, setFields] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFields = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/crm-config/custom-fields`);
      const json = await res.json();
      if (json.success) {
        setFields(json.data || []);
      }
    } catch {
      toast.error("Failed to load custom fields.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Custom Fields Engine
          </h1>
          <p className="text-xs text-slate-500">
            Tenant-scoped attribute extensions across 11 structured data types.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadFields} className="h-8 text-xs border-slate-200">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3">Field Label</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Field Type</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Values Count</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
                    Loading custom fields...
                  </td>
                </tr>
              ) : fields.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    No custom fields configured.
                  </td>
                </tr>
              ) : (
                fields.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-900">{f.label}</td>
                    <td className="px-4 py-3 font-mono text-indigo-600">{f.key}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {f.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">{f.fieldType}</td>
                    <td className="px-4 py-3 font-medium text-slate-600">{f.company?.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-800">{f._count?.values || 0}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase">
                        {f.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
