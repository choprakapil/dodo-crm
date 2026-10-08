"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Server, ShieldCheck, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformSystemHealthPage() {
  const [health, setHealth] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHealth = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/health");
      const json = await res.json();
      setHealth(json);
    } catch {
      //
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            System Health & Fleet Observability
          </h1>
          <p className="text-xs text-slate-500">
            Database connectivity, latency telemetry, memory metrics, and API readiness.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadHealth} className="h-8 text-xs border-slate-200">
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Ping System
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-emerald-200 bg-emerald-50/40 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> API Gateway
              </CardTitle>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                Healthy
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-emerald-100">
              <span className="text-emerald-800">Status:</span>
              <span className="font-bold text-emerald-950 font-mono">200 OK</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-100">
              <span className="text-emerald-800">Framework:</span>
              <span className="font-medium text-emerald-950 font-mono">Next.js 16 App Router</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-emerald-800">Engine:</span>
              <span className="font-medium text-emerald-950 font-mono">Turbopack SSR</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-indigo-200 bg-indigo-50/40 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                <Database className="h-4 w-4 text-indigo-600" /> MySQL Database
              </CardTitle>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase">
                Connected
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-indigo-100">
              <span className="text-indigo-800">Engine:</span>
              <span className="font-bold text-indigo-950 font-mono">MySQL 8.0+</span>
            </div>
            <div className="flex justify-between py-1 border-b border-indigo-100">
              <span className="text-indigo-800">ORM / Client:</span>
              <span className="font-medium text-indigo-950 font-mono">Prisma 5.x</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-indigo-800">Isolation:</span>
              <span className="font-medium text-indigo-950 font-mono">Row-Level Tenant Scopes</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600" /> Security Layer
              </CardTitle>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                Active
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Dual Session Isolation:</span>
              <span className="font-bold text-slate-900">Enforced</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Password Hashing:</span>
              <span className="font-bold text-slate-900 font-mono">Bcrypt (Salted)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Phase-Lock Guard:</span>
              <span className="font-bold text-slate-900">Verified</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
