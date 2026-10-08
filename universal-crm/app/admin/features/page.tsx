"use client";

import { useState } from "react";
import { Sliders, CheckCircle2, Shield, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PLATFORM_FEATURE_CATALOG, PlatformFeatureDefinition } from "@/lib/services/platform-feature.service";

export default function PlatformFeaturesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const categories = ["ALL", "CRM", "COMMUNICATION", "REPORTING", "SECURITY", "ADMINISTRATION", "INTEGRATION", "AUTOMATION", "ADVANCED"];

  const filtered = PLATFORM_FEATURE_CATALOG.filter((f) => {
    if (selectedCategory !== "ALL" && f.category !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Platform Feature Matrix & Capability Catalog
        </h1>
        <p className="text-xs text-slate-500">
          Global definitions of SaaS capabilities, default plan tier allocations, and server-side feature gates.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedCategory === cat
                ? "bg-indigo-600 text-white shadow-2xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((feat) => (
          <Card key={feat.key} className="border border-slate-200 bg-white shadow-2xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{feat.name}</span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                  {feat.category}
                </span>
              </div>
              <CardDescription className="text-xs text-slate-500 pt-1 leading-relaxed">
                {feat.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Default Plan Tiers:</span>
                <div className="flex gap-1">
                  {feat.defaultTiers.map((tier) => (
                    <span
                      key={tier}
                      className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border"
                    >
                      {tier}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
