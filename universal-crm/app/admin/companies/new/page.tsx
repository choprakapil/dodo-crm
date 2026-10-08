"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Layers,
  Shield,
  Sliders,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PLATFORM_FEATURE_CATALOG } from "@/lib/services/platform-feature.service";

const PLANS = [
  {
    code: "FREE",
    name: "Free Tier",
    price: "$0/mo",
    users: 2,
    leads: 250,
    customers: 250,
    deals: 100,
    description: "Basic evaluation tier for single operators and micro teams.",
  },
  {
    code: "STARTER",
    name: "Starter",
    price: "$49/mo",
    users: 5,
    leads: 1000,
    customers: 1000,
    deals: 500,
    description: "Growing sales teams requiring pipeline and customer management.",
  },
  {
    code: "PROFESSIONAL",
    name: "Professional",
    price: "$149/mo",
    users: 25,
    leads: 5000,
    customers: 5000,
    deals: 2500,
    description: "High-velocity sales organizations with advanced reporting and team scopes.",
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise",
    price: "$399/mo",
    users: 100,
    leads: 25000,
    customers: 25000,
    deals: 10000,
    description: "Unlimited scale, dedicated audit trails, and custom API access.",
  },
];

export default function CreateOrganizationWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");

  // Plan State
  const [selectedPlanCode, setSelectedPlanCode] = useState<"FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE">("STARTER");

  // Limits State (Overrides)
  const [usePlanLimits, setUsePlanLimits] = useState(true);
  const [maxUsersOverride, setMaxUsersOverride] = useState<number>(10);
  const [maxLeadsOverride, setMaxLeadsOverride] = useState<number>(2500);
  const [maxCustomersOverride, setMaxCustomersOverride] = useState<number>(2500);

  // Features State (Overrides)
  const [enabledFeatures, setEnabledFeatures] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    PLATFORM_FEATURE_CATALOG.forEach((f) => {
      initial[f.key] = f.defaultTiers.includes("STARTER");
    });
    return initial;
  });

  // Admin User State
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Created Result State
  const [createdResult, setCreatedResult] = useState<{
    company: { id: string; name: string; slug: string };
    admin: { email: string; temporaryPassword?: string };
  } | null>(null);

  const [copiedPass, setCopiedPass] = useState(false);

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"));
    }
  };

  // Generate secure password
  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    let pass = "Dodo@";
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += "!";
    setAdminPassword(pass);
    toast.success("Generated secure temporary password");
  };

  const handlePlanSelect = (code: "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE") => {
    setSelectedPlanCode(code);
    const updatedFeatures: Record<string, boolean> = {};
    PLATFORM_FEATURE_CATALOG.forEach((f) => {
      updatedFeatures[f.key] = f.defaultTiers.includes(code);
    });
    setEnabledFeatures(updatedFeatures);
  };

  const handleToggleFeature = (key: string) => {
    setEnabledFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleFinalSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        timezone,
        currency,
        planTier: selectedPlanCode,
        initialAdminName: adminName.trim() || contactName.trim() || "Organization Admin",
        initialAdminEmail: adminEmail.trim().toLowerCase() || email.trim().toLowerCase(),
        adminPassword: adminPassword.trim() || undefined,
        limitOverrides: !usePlanLimits
          ? {
              maxUsers: maxUsersOverride,
              maxLeads: maxLeadsOverride,
              maxCustomers: maxCustomersOverride,
            }
          : undefined,
        featureOverrides: enabledFeatures,
      };

      const res = await fetch("/api/v1/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to provision organization.");
      }

      setCreatedResult({
        company: json.data.company,
        admin: {
          email: payload.initialAdminEmail,
          temporaryPassword: adminPassword || json.data.temporaryPassword || "Sent via invitation link",
        },
      });

      setCurrentStep(6);
      toast.success("Organization successfully provisioned!");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
    toast.success("Password copied to clipboard");
  };

  const selectedPlan = PLANS.find((p) => p.code === selectedPlanCode)!;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/companies"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Organizations
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create Organization Wizard
          </h1>
          <p className="text-xs text-slate-500">
            Multi-step SaaS tenant provisioning with custom quotas, features, and initial admin setup.
          </p>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="grid grid-cols-6 gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {[
          { step: 1, label: "Organization", icon: Building2 },
          { step: 2, label: "Plan", icon: Layers },
          { step: 3, label: "Limits", icon: Shield },
          { step: 4, label: "Features", icon: Sliders },
          { step: 5, label: "Admin User", icon: UserCheck },
          { step: 6, label: "Confirmation", icon: CheckCircle2 },
        ].map((s) => {
          const Icon = s.icon;
          const isCurrent = currentStep === s.step;
          const isPassed = currentStep > s.step;
          return (
            <div
              key={s.step}
              className={`flex items-center gap-2.5 p-2 rounded-xl transition ${
                isCurrent
                  ? "bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold shadow-2xs"
                  : isPassed
                  ? "text-slate-700 font-semibold"
                  : "text-slate-400 opacity-60"
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                  isCurrent
                    ? "bg-indigo-600 text-white"
                    : isPassed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {isPassed ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
                  Step {s.step}
                </span>
                <span className="text-xs leading-none">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Organization Details */}
      {currentStep === 1 && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Step 1: Organization Identity & Regional Settings
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Set the primary tenant company name, URL slug identifier, and localization defaults.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="orgName" className="text-xs font-medium text-slate-700">
                  Organization Name *
                </Label>
                <Input
                  id="orgName"
                  placeholder="e.g. Acme Global Industries"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgSlug" className="text-xs font-medium text-slate-700">
                  URL Slug Identifier *
                </Label>
                <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
                  <span>dodo.crm/</span>
                  <input
                    id="orgSlug"
                    placeholder="acme-global"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="w-full bg-transparent py-2 pl-1 font-mono text-xs text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contactName" className="text-xs font-medium text-slate-700">
                  Primary Contact Person
                </Label>
                <Input
                  id="contactName"
                  placeholder="e.g. John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                  Organization Contact Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@acme.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (!adminEmail) setAdminEmail(e.target.value);
                  }}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium text-slate-700">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  placeholder="+1 555 019 2834"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="currency" className="text-xs font-medium text-slate-700">
                    Base Currency
                  </Label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="AUD">AUD ($)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="timezone" className="text-xs font-medium text-slate-700">
                    Timezone
                  </Label>
                  <select
                    id="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="UTC">UTC (Coordinated Universal)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                onClick={() => {
                  if (!name.trim() || !slug.trim()) {
                    toast.error("Please provide both organization name and slug.");
                    return;
                  }
                  setCurrentStep(2);
                }}
                className="bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <span>Continue to Plan Selection</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Plan Selection */}
      {currentStep === 2 && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Step 2: Subscription Tier Selection
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Choose the baseline pricing plan. Default quota limits and enabled features will be seeded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {PLANS.map((plan) => {
                const isSelected = selectedPlanCode === plan.code;
                return (
                  <div
                    key={plan.code}
                    onClick={() => handlePlanSelect(plan.code as any)}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? "border-indigo-600 bg-indigo-50/50 shadow-md ring-2 ring-indigo-600/20"
                        : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                          {plan.name}
                        </span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                      </div>
                      <div className="text-xl font-bold text-slate-900 mb-1">{plan.price}</div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                        {plan.description}
                      </p>
                    </div>

                    <div className="space-y-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                      <div className="flex justify-between">
                        <span>Seats:</span>
                        <span className="font-semibold text-slate-900">{plan.users} Users</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Leads:</span>
                        <span className="font-semibold text-slate-900">{plan.leads.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Customers:</span>
                        <span className="font-semibold text-slate-900">{plan.customers.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex justify-between border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-slate-600"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                className="bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <span>Continue to Limits</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Quota Limits & Overrides */}
      {currentStep === 3 && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Step 3: Platform Quotas & Limit Customization
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Keep the {selectedPlan.name} plan defaults or configure custom organization-level capacity overrides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode Toggle */}
            <div className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="limitMode"
                  checked={usePlanLimits}
                  onChange={() => setUsePlanLimits(true)}
                  className="text-indigo-600"
                />
                <span>Use {selectedPlan.name} Plan Defaults</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="limitMode"
                  checked={!usePlanLimits}
                  onChange={() => setUsePlanLimits(false)}
                  className="text-indigo-600"
                />
                <span>Custom Organization Overrides</span>
              </label>
            </div>

            {/* Limits Table */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <span className="text-xs font-semibold text-slate-700">Active User Seats</span>
                <div className="text-xl font-bold text-slate-900">
                  {usePlanLimits ? selectedPlan.users : maxUsersOverride} Seats
                </div>
                {!usePlanLimits && (
                  <div className="pt-2">
                    <Label className="text-[10px] text-slate-500">Override Seat Limit</Label>
                    <Input
                      type="number"
                      value={maxUsersOverride}
                      onChange={(e) => setMaxUsersOverride(parseInt(e.target.value, 10) || 1)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                )}
                <span className="text-[10px] text-slate-400">Plan Default: {selectedPlan.users}</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <span className="text-xs font-semibold text-slate-700">Lead Pipeline Capacity</span>
                <div className="text-xl font-bold text-slate-900">
                  {usePlanLimits ? selectedPlan.leads.toLocaleString() : maxLeadsOverride.toLocaleString()} Leads
                </div>
                {!usePlanLimits && (
                  <div className="pt-2">
                    <Label className="text-[10px] text-slate-500">Override Lead Capacity</Label>
                    <Input
                      type="number"
                      value={maxLeadsOverride}
                      onChange={(e) => setMaxLeadsOverride(parseInt(e.target.value, 10) || 100)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                )}
                <span className="text-[10px] text-slate-400">Plan Default: {selectedPlan.leads.toLocaleString()}</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                <span className="text-xs font-semibold text-slate-700">Customer Records</span>
                <div className="text-xl font-bold text-slate-900">
                  {usePlanLimits ? selectedPlan.customers.toLocaleString() : maxCustomersOverride.toLocaleString()} Customers
                </div>
                {!usePlanLimits && (
                  <div className="pt-2">
                    <Label className="text-[10px] text-slate-500">Override Customer Records</Label>
                    <Input
                      type="number"
                      value={maxCustomersOverride}
                      onChange={(e) => setMaxCustomersOverride(parseInt(e.target.value, 10) || 100)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                )}
                <span className="text-[10px] text-slate-400">Plan Default: {selectedPlan.customers.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-4 flex justify-between border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                className="text-xs text-slate-600"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
              </Button>
              <Button
                onClick={() => setCurrentStep(4)}
                className="bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <span>Continue to Features</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Features Matrix */}
      {currentStep === 4 && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Step 4: Platform Feature Capabilities
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Configure enabled SaaS features for this organization. Toggled features are enforced server-side.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PLATFORM_FEATURE_CATALOG.map((feat) => {
                const isChecked = Boolean(enabledFeatures[feat.key]);
                return (
                  <div
                    key={feat.key}
                    onClick={() => handleToggleFeature(feat.key)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-2 ${
                      isChecked
                        ? "border-indigo-200 bg-indigo-50/40"
                        : "border-slate-200 bg-white opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900">{feat.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold uppercase">
                          {feat.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}}
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 mt-0.5"
                    />
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex justify-between border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(3)}
                className="text-xs text-slate-600"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
              </Button>
              <Button
                onClick={() => setCurrentStep(5)}
                className="bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <span>Continue to Administrator</span>
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Administrator Setup */}
      {currentStep === 5 && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              Step 5: Initial Organization Administrator Setup
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Create the initial tenant Company Admin account. You can set or generate a secure temporary password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="adminName" className="text-xs font-medium text-slate-700">
                  Administrator Full Name *
                </Label>
                <Input
                  id="adminName"
                  placeholder="e.g. Sarah Johnson"
                  value={adminName || contactName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminEmail" className="text-xs font-medium text-slate-700">
                  Administrator Email Address *
                </Label>
                <Input
                  id="adminEmail"
                  type="email"
                  placeholder="admin@acme.com"
                  value={adminEmail || email}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="adminPassword" className="text-xs font-medium text-slate-700">
                    Initial Password
                  </Label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Generate Secure Password
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="adminPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password or leave blank for activation email invitation"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="h-9 text-xs font-mono pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <span className="text-[11px] text-slate-500">
                  If left blank, an invitation link with token activation will be generated.
                </span>
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2 mt-4">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                Provisioning Summary
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Organization:</span>
                  <span className="font-semibold">{name || "Untitled"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Plan Tier:</span>
                  <span className="font-semibold">{selectedPlan.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Seat Quota:</span>
                  <span className="font-semibold">{usePlanLimits ? selectedPlan.users : maxUsersOverride} Seats</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Admin Email:</span>
                  <span className="font-semibold truncate">{adminEmail || email || "Not set"}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(4)}
                className="text-xs text-slate-600"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back
              </Button>
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Provisioning Organization...
                  </>
                ) : (
                  <>
                    <span>Confirm & Create Organization</span>
                    <Check className="ml-1.5 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 6: Confirmation & Sensitive Credentials Screen */}
      {currentStep === 6 && createdResult && (
        <Card className="border border-emerald-200 bg-white shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">
              Organization Provisioned Successfully!
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              The tenant infrastructure, database scopes, roles, and initial administrator have been seeded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {/* Sensitive Credentials Card */}
            <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <KeyRound className="h-4 w-4 text-amber-600" />
                <span>Confidential Administrator Credentials</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Save these credentials now. For security reasons, temporary passwords are encrypted and cannot be retrieved later.
              </p>

              <div className="p-3 rounded-xl bg-white border border-amber-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Admin Email:</span>
                  <span className="font-mono font-bold text-slate-900">{createdResult.admin.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Temporary Password:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      {createdResult.admin.temporaryPassword}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdResult.admin.temporaryPassword || "")}
                      className="p-1 rounded hover:bg-slate-100 text-slate-600"
                      title="Copy Password"
                    >
                      {copiedPass ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Login URL:</span>
                  <span className="font-mono text-slate-700">http://localhost:3000/login</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-center gap-3">
              <Link href={`/admin/companies/${createdResult.company.id}`}>
                <Button className="bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700">
                  Open Organization Cockpit
                </Button>
              </Link>
              <Link href="/admin/companies">
                <Button variant="outline" className="text-xs text-slate-700">
                  View All Organizations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
