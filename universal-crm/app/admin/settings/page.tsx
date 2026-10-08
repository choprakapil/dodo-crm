"use client";

import { Settings, Shield, KeyRound, Bell, Sliders } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PlatformSettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Platform Global Settings
        </h1>
        <p className="text-xs text-slate-500">
          Super Admin platform configuration, security policies, and environment parameters.
        </p>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-900">
            Platform Branding & Environment
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Product name, version, and runtime standards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Product Name</span>
              <span className="font-bold text-slate-900 text-sm">DODO CRM</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Version</span>
              <span className="font-mono text-indigo-700 font-bold">v2.0 Client Edition</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Environment</span>
              <span className="font-mono text-emerald-700 font-bold">Local Development (MySQL)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-mono">Super Admin Cookie</span>
              <span className="font-mono text-slate-700">universal_crm_superadmin_session</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
