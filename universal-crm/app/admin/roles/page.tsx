"use client";

import { useEffect, useState } from "react";
import { UserCheck, Shield, RefreshCw, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PlatformRolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/crm-config/roles`);
      const json = await res.json();
      if (json.success) {
        setRoles(json.data || []);
      }
    } catch {
      toast.error("Failed to load roles.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Roles & Permission Matrix
          </h1>
          <p className="text-xs text-slate-500">
            System and custom tenant roles, action scopes (OWN, TEAM, COMPANY), and RBAC enforcement.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadRoles} className="h-8 text-xs border-slate-200">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 py-12 text-center text-xs text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
            Loading roles...
          </div>
        ) : (
          roles.map((r) => (
            <Card key={r.id} className="border border-slate-200 bg-white shadow-2xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{r.name}</span>
                    {r.isSystem && (
                      <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700">
                        <Lock className="h-2.5 w-2.5" /> SYSTEM
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {r._count?.users || 0} users assigned
                  </span>
                </div>
                <CardDescription className="text-xs text-slate-500">
                  {r.description || `Configured for ${r.company?.name}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 border-t border-slate-100">
                <div className="flex flex-wrap gap-1.5">
                  {r.permissions?.slice(0, 8).map((p: any) => (
                    <span
                      key={p.id}
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                    >
                      {p.module}:{p.action} [{p.dataScope}]
                    </span>
                  ))}
                  {r.permissions?.length > 8 && (
                    <span className="text-[10px] text-slate-400 self-center">
                      +{r.permissions.length - 8} more
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
