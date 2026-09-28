"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProvisionCompanyPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [planTier, setPlanTier] = useState<string>("STARTER");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisionedData, setProvisionedData] = useState<{
    company: { id: string; name: string; slug: string };
    inviteUrl: string;
  } | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  // Auto-generate slug when name changes if slug wasn't manually edited
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    const suggestedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setSlug(suggestedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          initialAdminName: adminName,
          initialAdminEmail: adminEmail,
          planTier,
          timezone,
          currency,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to provision company.");
        return;
      }

      setProvisionedData(json.data);
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (provisionedData?.inviteUrl) {
      navigator.clipboard.writeText(provisionedData.inviteUrl);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2500);
    }
  };

  if (provisionedData) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Company Provisioned Successfully!
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {provisionedData.company.name} has been created with all system roles, default pipeline statuses, and an initial admin account.
          </p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              One-Time Admin Onboarding & Activation Link
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={provisionedData.inviteUrl}
                className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 font-mono select-all"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copyInviteLink}
                className="shrink-0 text-xs"
              >
                {hasCopied ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Send this link to the initial administrator to establish their password and activate their account. Valid for 7 days.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href={`/admin/companies/${provisionedData.company.id}`}>
              <Button size="sm" className="bg-indigo-600 font-medium text-white hover:bg-indigo-500">
                Inspect Company
              </Button>
            </Link>
            <Link href="/admin/companies">
              <Button size="sm" variant="outline">
                Back to Fleet
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/companies"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Fleet List
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Provision New Tenant</h1>
            <p className="text-xs text-slate-500">
              Atomically creates company, system roles, lead defaults, and admin onboarding invitation.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={handleNameChange}
                placeholder="e.g. Apex Global Logistics"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Company URL Slug <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="e.g. apex-global"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Lowercase letters, numbers, and hyphens only</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Initial Admin Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="e.g. Samantha Vance"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Initial Admin Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="samantha@apexlogistics.com"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Subscription Plan <span className="text-red-500">*</span>
              </label>
              <select
                value={planTier}
                onChange={(e) => setPlanTier(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="FREE">Free (2 Users, 100 Leads)</option>
                <option value="STARTER">Starter (5 Users, 1,000 Leads)</option>
                <option value="PROFESSIONAL">Professional (25 Users, 10,000 Leads)</option>
                <option value="ENTERPRISE">Enterprise (100 Users, 100,000 Leads)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Chicago">America/Chicago (CST)</option>
                <option value="America/Denver">America/Denver (MST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/admin/companies">
              <Button type="button" variant="outline" size="sm" className="text-xs">
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              disabled={isLoading}
              size="sm"
              className="bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Provisioning Tenant...
                </>
              ) : (
                "Provision Company"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
