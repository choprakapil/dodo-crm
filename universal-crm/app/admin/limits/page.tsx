"use client";

import { Shield, Layers, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const LIMIT_DEFINITIONS = [
  {
    key: "maxUsers",
    name: "User Seat Quota",
    category: "SEATS",
    description: "Maximum active tenant user accounts allowed simultaneously.",
    defaults: { FREE: 2, STARTER: 5, PROFESSIONAL: 25, ENTERPRISE: 100 },
  },
  {
    key: "maxLeads",
    name: "Lead Pipeline Capacity",
    category: "DATA",
    description: "Maximum concurrent open and qualified lead records.",
    defaults: { FREE: 250, STARTER: 1000, PROFESSIONAL: 5000, ENTERPRISE: 25000 },
  },
  {
    key: "maxCustomers",
    name: "Customer Database Records",
    category: "DATA",
    description: "Lifetime customer directory profiles stored in tenant scope.",
    defaults: { FREE: 250, STARTER: 1000, PROFESSIONAL: 5000, ENTERPRISE: 25000 },
  },
  {
    key: "maxTeams",
    name: "Organizational Teams",
    category: "SEATS",
    description: "Departmental team divisions and manager scope containers.",
    defaults: { FREE: 1, STARTER: 5, PROFESSIONAL: 20, ENTERPRISE: 50 },
  },
  {
    key: "maxProducts",
    name: "Product Catalog Items",
    category: "CATALOG",
    description: "Active commercial product SKU definitions.",
    defaults: { FREE: 10, STARTER: 50, PROFESSIONAL: 250, ENTERPRISE: 1000 },
  },
  {
    key: "maxServices",
    name: "Service Offerings",
    category: "CATALOG",
    description: "Billable and recurring service package configurations.",
    defaults: { FREE: 5, STARTER: 25, PROFESSIONAL: 100, ENTERPRISE: 500 },
  },
  {
    key: "maxDispositions",
    name: "Hierarchical Call Dispositions",
    category: "SYSTEM",
    description: "Custom outcome definitions for lead call workflows.",
    defaults: { FREE: 20, STARTER: 50, PROFESSIONAL: 100, ENTERPRISE: 200 },
  },
  {
    key: "maxCustomFields",
    name: "Custom Field Definitions",
    category: "SYSTEM",
    description: "Configurable entity attributes across Lead and Customer models.",
    defaults: { FREE: 5, STARTER: 15, PROFESSIONAL: 50, ENTERPRISE: 100 },
  },
];

export default function PlatformLimitsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Platform Limits & Quota Specifications
        </h1>
        <p className="text-xs text-slate-500">
          Centralized capacity rules, plan defaults, and server-side assertion metrics.
        </p>
      </div>

      <Card className="border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Standard Plan Quota Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-3">Limit Metric</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Free Tier</th>
                <th className="px-4 py-3">Starter</th>
                <th className="px-4 py-3">Professional</th>
                <th className="px-4 py-3">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {LIMIT_DEFINITIONS.map((def) => (
                <tr key={def.key} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{def.name}</span>
                      <span className="text-[11px] text-slate-500">{def.description}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      {def.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{def.defaults.FREE.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{def.defaults.STARTER.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono font-bold text-indigo-700">{def.defaults.PROFESSIONAL.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{def.defaults.ENTERPRISE.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
