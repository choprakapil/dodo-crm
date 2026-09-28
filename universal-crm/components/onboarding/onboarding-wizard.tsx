"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Package,
  GitFork,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Sparkles,
  LayoutTemplate,
  Layers,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface OnboardingWizardProps {
  initialState: {
    onboardingCompleted: boolean;
    onboardingStep: string;
    company: {
      id: string;
      name: string;
      slug: string;
      email: string | null;
      phone: string | null;
      website: string | null;
      timezone: string;
      currency: string;
      defaultCountryCode: string;
      appliedTemplateKey?: string | null;
      appliedTemplateVersion?: number | null;
      appliedTemplateAt?: Date | null;
    };
    metrics: {
      userCount: number;
      teamCount: number;
      offeringCount: number;
      statusCount: number;
      sourceCount: number;
    };
    canManage: boolean;
  };
}

export function OnboardingWizard({ initialState }: OnboardingWizardProps) {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<string>(
    initialState.onboardingCompleted ? "COMPLETED" : initialState.onboardingStep || "PROFILE"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states - Step 1: Profile
  const [name, setName] = useState(initialState.company.name || "");
  const [email, setEmail] = useState(initialState.company.email || "");
  const [phone, setPhone] = useState(initialState.company.phone || "");
  const [website, setWebsite] = useState(initialState.company.website || "");
  const [timezone, setTimezone] = useState(initialState.company.timezone || "UTC");
  const [currency, setCurrency] = useState(initialState.company.currency || "USD");
  const [defaultCountryCode, setDefaultCountryCode] = useState(
    initialState.company.defaultCountryCode || "IN"
  );

  // Form states - Step 2: Industry Blueprint Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("general-sales");
  const [previewReport, setPreviewReport] = useState<any | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [appliedTemplateInfo, setAppliedTemplateInfo] = useState<{
    key: string | null;
    version: number | null;
    at: string | null;
  }>({
    key: initialState.company.appliedTemplateKey || null,
    version: initialState.company.appliedTemplateVersion || null,
    at: initialState.company.appliedTemplateAt ? String(initialState.company.appliedTemplateAt) : null,
  });

  // Form states - Step 3: Invite team member (quick action)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitedMembers, setInvitedMembers] = useState<string[]>([]);
  const [isInviting, setIsInviting] = useState(false);

  // Form states - Step 4: Offering (quick action)
  const [offeringName, setOfferingName] = useState("");
  const [offeringType, setOfferingType] = useState<"PRODUCT" | "SERVICE">("SERVICE");
  const [offeringPrice, setOfferingPrice] = useState("");
  const [createdOfferings, setCreatedOfferings] = useState<string[]>([]);
  const [isCreatingOffering, setIsCreatingOffering] = useState(false);

  // Metrics tracking
  const [metrics, setMetrics] = useState(initialState.metrics);

  const steps = [
    { id: "PROFILE", label: "Company Profile", icon: Building2, required: true },
    { id: "TEMPLATES", label: "Industry Blueprint", icon: LayoutTemplate, required: false },
    { id: "TEAM", label: "Team Members", icon: Users, required: false },
    { id: "OFFERINGS", label: "Products & Services", icon: Package, required: false },
    { id: "PIPELINE", label: "Pipeline Stages", icon: GitFork, required: false },
    { id: "COMPLETED", label: "Review & Launch", icon: CheckCircle2, required: true },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const saveStepNavigation = async (nextStep: string) => {
    try {
      await fetch("/api/v1/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep }),
      });
    } catch {
      // Step navigation persistence best-effort
    }
    setCurrentStep(nextStep);
  };

  // Load templates on mount or entering TEMPLATES step
  useEffect(() => {
    if (templates.length === 0) {
      fetch("/api/v1/templates")
        .then((res) => res.json())
        .then((json) => {
          if (json.success && Array.isArray(json.data)) {
            setTemplates(json.data);
          }
        })
        .catch(() => {});
    }
  }, [templates.length]);

  // Load preview whenever selected template changes
  useEffect(() => {
    if (selectedTemplateKey) {
      setIsPreviewLoading(true);
      fetch(`/api/v1/templates/${selectedTemplateKey}/preview`, {
        method: "POST",
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setPreviewReport(json.data);
          }
        })
        .catch(() => {})
        .finally(() => setIsPreviewLoading(false));
    }
  }, [selectedTemplateKey]);

  // Handle Apply Template
  const handleApplyTemplate = async () => {
    setIsApplyingTemplate(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/templates/${selectedTemplateKey}/apply`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to apply industry blueprint.");
        return;
      }

      setAppliedTemplateInfo({
        key: json.data.templateKey,
        version: json.data.templateVersion,
        at: new Date().toISOString(),
      });

      setSuccessMessage(
        `Applied "${json.data.templateKey}@${json.data.templateVersion}" blueprint: ${json.data.createdCount} items configured (${json.data.skippedCount} existing matches skipped).`
      );
      setTimeout(() => setSuccessMessage(null), 4000);

      // Re-fetch preview to update statuses
      const previewRes = await fetch(`/api/v1/templates/${selectedTemplateKey}/preview`, {
        method: "POST",
      });
      const previewJson = await previewRes.json();
      if (previewJson.success && previewJson.data) {
        setPreviewReport(previewJson.data);
      }
    } catch {
      setError("An unexpected network error occurred while applying the template.");
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  // Step 1: Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          website: website || undefined,
          timezone,
          currency,
          defaultCountryCode,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to update company profile.");
        return;
      }

      setSuccessMessage("Company profile saved.");
      setTimeout(() => setSuccessMessage(null), 3000);
      setCurrentStep("TEMPLATES");
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };


  // Step 2: Quick Invite Colleague
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    setError(null);

    try {
      // Fetch available roles to get Sales Rep or Manager role
      const rolesRes = await fetch("/api/v1/roles");
      const rolesJson = await rolesRes.json();
      const roles = rolesJson.data || [];
      const defaultRole = roles.find((r: any) => r.name === "Sales Rep") || roles[0];

      const res = await fetch("/api/v1/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName || undefined,
          roleId: defaultRole?.id,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to send invitation.");
        return;
      }

      setInvitedMembers((prev) => [...prev, inviteEmail]);
      setMetrics((m) => ({ ...m, userCount: m.userCount + 1 }));
      setInviteEmail("");
      setInviteName("");
      setSuccessMessage(`Invitation sent to ${inviteEmail}.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("Failed to dispatch invitation.");
    } finally {
      setIsInviting(false);
    }
  };

  // Step 3: Quick Add Offering
  const handleAddOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offeringName) return;
    setIsCreatingOffering(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/offerings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: offeringName,
          type: offeringType,
          basePrice: offeringPrice ? parseFloat(offeringPrice) : undefined,
          currency,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to create catalog item.");
        return;
      }

      setCreatedOfferings((prev) => [...prev, offeringName]);
      setMetrics((m) => ({ ...m, offeringCount: m.offeringCount + 1 }));
      setOfferingName("");
      setOfferingPrice("");
      setSuccessMessage(`Added "${offeringName}" to catalog.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch {
      setError("Failed to create offering.");
    } finally {
      setIsCreatingOffering(false);
    }
  };

  // Step 5: Finalize Onboarding
  const handleComplete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/onboarding/complete", {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to complete onboarding.");
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setError("Network error while completing setup.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-32 h-32 text-indigo-400" />
        </div>
        <div className="max-w-2xl relative z-10">
          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs px-2.5 py-0.5 mb-3 font-mono">
            Tenant Activation Wizard
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome to Universal CRM, {name || initialState.company.name}
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Let&apos;s establish the foundational setup for your company workspace. You can complete all steps now
            or resume at any point. All settings remain fully configurable in Settings later.
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="mt-8 border-t border-slate-800 pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isPast = idx < currentStepIndex;
              const isCurrent = s.id === currentStep;

              return (
                <button
                  key={s.id}
                  onClick={() => saveStepNavigation(s.id)}
                  type="button"
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? "border-indigo-500 bg-indigo-500/10 text-white"
                      : isPast
                      ? "border-emerald-500/30 bg-emerald-500/5 text-slate-300 hover:border-emerald-500/50"
                      : "border-slate-800 bg-slate-950/40 text-slate-500 hover:text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isCurrent
                          ? "bg-indigo-600 text-white"
                          : isPast
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isPast ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className="text-[10px] uppercase font-mono text-slate-500">
                      Step {idx + 1}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="text-xs font-semibold block leading-tight">{s.label}</span>
                    <span className="text-[10px] text-slate-500">
                      {s.required ? "Required" : "Optional"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* STEP CONTENT CONTAINER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        {/* =================================================================== */}
        {/* STEP 1: COMPANY PROFILE */}
        {/* =================================================================== */}
        {currentStep === "PROFILE" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-400" />
                1. Company Profile & Regional Settings
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure your organization identity, currency, and default operational timezone.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Company Legal / Trading Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Company Slug (Subdomain / URL)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={initialState.company.slug}
                    className="mt-1.5 w-full bg-slate-950/60 border border-slate-800/80 rounded-lg px-3.5 py-2 text-xs text-slate-500 font-mono select-all cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Primary Business Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="contact@company.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="+1 555-0199"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    placeholder="https://company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Default Timezone <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="UTC">UTC (Universal Coordinated)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Currency <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                    <option value="INR">INR (₹ - Indian Rupee)</option>
                    <option value="CAD">CAD ($ - Canadian Dollar)</option>
                    <option value="AUD">AUD ($ - Australian Dollar)</option>
                    <option value="SGD">SGD ($ - Singapore Dollar)</option>
                    <option value="AED">AED (د.إ - UAE Dirham)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Default Phone Country Code
                  </label>
                  <select
                    value={defaultCountryCode}
                    onChange={(e) => setDefaultCountryCode(e.target.value)}
                    className="mt-1.5 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="US">United States (+1)</option>
                    <option value="GB">United Kingdom (+44)</option>
                    <option value="IN">India (+91)</option>
                    <option value="CA">Canada (+1)</option>
                    <option value="AU">Australia (+61)</option>
                    <option value="AE">UAE (+971)</option>
                    <option value="SG">Singapore (+65)</option>
                    <option value="DE">Germany (+49)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving Profile...
                    </>
                  ) : (
                    <>
                      Save & Next Step <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 2: INDUSTRY BLUEPRINT (TEMPLATES) */}
        {/* =================================================================== */}
        {currentStep === "TEMPLATES" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5 text-indigo-400" />
                  2. Optional Industry Blueprint
                </h2>
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-xs bg-indigo-500/10">
                  Optional Setup
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Choose an optional industry blueprint to pre-populate custom fields, inquiry dispositions, and lead sources tailored to your sector.
                <strong> Universal CRM remains completely industry-neutral</strong> — this only seeds initial configuration that your team fully owns and can modify anytime.
              </p>
            </div>

            {/* Template Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {templates.map((tpl) => {
                const isSelected = tpl.key === selectedTemplateKey;
                const isApplied = appliedTemplateInfo.key === tpl.key;

                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => setSelectedTemplateKey(tpl.key)}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all relative ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/10 text-white shadow-lg shadow-indigo-500/10"
                        : "border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-300"
                    }`}
                  >
                    {isApplied && (
                      <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <Check className="w-3 h-3" /> Applied
                      </span>
                    )}
                    <span className="text-xs font-bold text-white block mt-1">{tpl.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">v{tpl.version}</span>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                      {tpl.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{tpl.configurationSummary?.customerFieldsCount || 0} fields</span>
                      <span>{tpl.configurationSummary?.dispositionsCount || 0} dispositions</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dry Run / Configuration Preview */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Blueprint Preview: {selectedTemplateKey}
                  </span>
                </div>
                {isPreviewLoading ? (
                  <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analyzing configuration...
                  </div>
                ) : previewReport ? (
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-emerald-400">+{previewReport.toCreateCount} to create</span>
                    <span className="text-slate-500">{previewReport.toSkipCount} existing matches</span>
                    {previewReport.conflictsCount > 0 && (
                      <span className="text-amber-400 font-bold">{previewReport.conflictsCount} conflicts</span>
                    )}
                  </div>
                ) : null}
              </div>

              {previewReport && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Custom Fields */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Custom Fields ({previewReport.items.customFields.length})
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                      {previewReport.items.customFields.map((f: any) => (
                        <div
                          key={`${f.entityType}-${f.key}`}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80"
                        >
                          <div>
                            <span className="font-semibold text-white block">{f.label}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {f.entityType}.{f.key} ({f.fieldType})
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              f.action === "CREATE"
                                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                                : f.action === "CONFLICT"
                                ? "border-amber-500/30 text-amber-400 bg-amber-500/5"
                                : "border-slate-700 text-slate-400"
                            }`}
                          >
                            {f.action}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dispositions & Sources */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Dispositions & Sources ({previewReport.items.dispositions.length + previewReport.items.leadSources.length})
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                      {previewReport.items.dispositions.map((d: any) => (
                        <div
                          key={d.key}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80"
                        >
                          <div>
                            <span className="font-semibold text-white block">{d.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Disposition • {d.stage}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              d.action === "CREATE"
                                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                                : "border-slate-700 text-slate-400"
                            }`}
                          >
                            {d.action}
                          </Badge>
                        </div>
                      ))}
                      {previewReport.items.leadSources.map((s: any) => (
                        <div
                          key={s.key}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800/80"
                        >
                          <div>
                            <span className="font-semibold text-white block">{s.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">Lead Source</span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              s.action === "CREATE"
                                ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                                : "border-slate-700 text-slate-400"
                            }`}
                          >
                            {s.action}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation and Apply Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("PROFILE")}
                className="text-xs"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => saveStepNavigation("TEAM")}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Skip Blueprint
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyTemplate}
                  disabled={isApplyingTemplate || !selectedTemplateKey}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5"
                >
                  {isApplyingTemplate ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying Blueprint...
                    </>
                  ) : appliedTemplateInfo.key === selectedTemplateKey ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-emerald-400" /> Re-apply / Sync Blueprint
                    </>
                  ) : (
                    <>
                      Apply Blueprint
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => saveStepNavigation("TEAM")}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4"
                >
                  Continue to Team <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3: TEAM SETUP */}
        {/* =================================================================== */}
        {currentStep === "TEAM" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-400" />
                  3. Team Collaboration & User Accounts
                </h2>
                <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                  Optional Setup
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Invite your colleagues to join this tenant. Universal CRM comes with 5 pre-configured roles:
                Admin, Manager, Sales Rep, Viewer, and Support.
              </p>
            </div>

            {/* Quick Invite Form */}
            <form onSubmit={handleInviteUser} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Invite Colleague</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Full Name (optional)"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isInviting || !inviteEmail}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  {isInviting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1" />
                  )}
                  Send Invitation
                </Button>
              </div>
            </form>

            {/* Invited list */}
            {invitedMembers.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                  Invitations Dispatched This Session
                </span>
                <div className="space-y-1">
                  {invitedMembers.map((email) => (
                    <div key={email} className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{email}</span>
                      <Badge variant="outline" className="border-slate-800 text-[10px] text-slate-500">
                        Sales Rep
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/20 text-xs text-slate-400">
              💡 Current active tenant users: <strong className="text-white">{metrics.userCount}</strong>. You can also configure structured teams and custom roles under <strong>Settings &gt; Team</strong> anytime.
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("TEMPLATES")}
                className="text-xs"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => saveStepNavigation("OFFERINGS")}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Skip for Now
                </Button>
                <Button
                  type="button"
                  onClick={() => saveStepNavigation("OFFERINGS")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5"
                >
                  Next Step <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 4: OFFERINGS & CATALOG */}
        {/* =================================================================== */}
        {currentStep === "OFFERINGS" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-400" />
                  4. Products & Services (Catalog)
                </h2>
                <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs">
                  Optional Setup
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Establish the items your organization sells or consults on. These power Enquiry/Lead
                line items, pricing, and revenue calculations.
              </p>
            </div>

            {/* Quick Add Offering Form */}
            <form onSubmit={handleAddOffering} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Add Initial Catalog Item</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={offeringName}
                  onChange={(e) => setOfferingName(e.target.value)}
                  placeholder="e.g. Standard Consultation or Model X"
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none sm:col-span-1"
                />
                <select
                  value={offeringType}
                  onChange={(e) => setOfferingType(e.target.value as any)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="SERVICE">Service</option>
                  <option value="PRODUCT">Physical / Digital Product</option>
                </select>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-500 font-mono">{currency}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={offeringPrice}
                    onChange={(e) => setOfferingPrice(e.target.value)}
                    placeholder="Base Price (e.g. 500)"
                    className="bg-slate-900 border border-slate-800 rounded-lg pl-12 pr-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isCreatingOffering || !offeringName}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  {isCreatingOffering ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1" />
                  )}
                  Add to Catalog
                </Button>
              </div>
            </form>

            {/* Created Offerings list */}
            {createdOfferings.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                  Catalog Items Added This Session
                </span>
                <div className="space-y-1">
                  {createdOfferings.map((name) => (
                    <div key={name} className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/20 text-xs text-slate-400">
              💡 Current catalog offerings: <strong className="text-white">{metrics.offeringCount}</strong>. You can manage tier pricing, SKUs, and custom discounts under <strong>Settings &gt; Offerings</strong>.
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("TEAM")}
                className="text-xs"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => saveStepNavigation("PIPELINE")}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Skip for Now
                </Button>
                <Button
                  type="button"
                  onClick={() => saveStepNavigation("PIPELINE")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5"
                >
                  Next Step <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 5: PIPELINE & LEAD WORKFLOW */}
        {/* =================================================================== */}
        {currentStep === "PIPELINE" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-indigo-400" />
                  5. Pipeline & Enquiry Lifecycle
                </h2>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                  Pre-Configured
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Your tenant includes a standard 6-stage sales pipeline and 5 primary acquisition sources.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <span className="text-xs font-bold text-slate-200 block">Default Pipeline Stages ({metrics.statusCount})</span>
                <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> 1. New (Inbound)</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> 2. Contacted</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-500" /> 3. Interested</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pink-500" /> 4. Proposal Sent</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 5. Converted (Won)</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> 6. Lost</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <span className="text-xs font-bold text-slate-200 block">Default Lead Sources ({metrics.sourceCount})</span>
                <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                  <div>• Website</div>
                  <div>• Google Ads</div>
                  <div>• Referral</div>
                  <div>• Cold Call</div>
                  <div>• Trade Show</div>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              You can add custom pipeline stages, lead disposition reason trees, and mandatory follow-up
              rules under <strong>Settings &gt; Dispositions</strong> anytime.
            </p>

            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("OFFERINGS")}
                className="text-xs"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button
                type="button"
                onClick={() => saveStepNavigation("COMPLETED")}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5"
              >
                Review Setup <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 6: REVIEW & COMPLETE */}
        {/* =================================================================== */}
        {currentStep === "COMPLETED" && (
          <div className="space-y-6">
            <div className="text-center max-w-lg mx-auto py-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-white">
                Workspace Setup Complete!
              </h2>
              <p className="text-xs text-slate-400 mt-1.5">
                Your tenant is ready for daily operations. Review your configuration summary below and launch the CRM.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Company Identity</span>
                <div className="space-y-1 text-xs">
                  <div><strong className="text-slate-300">Name:</strong> <span className="text-white">{name}</span></div>
                  <div><strong className="text-slate-300">Slug:</strong> <span className="text-slate-400 font-mono">{initialState.company.slug}</span></div>
                  <div><strong className="text-slate-300">Email:</strong> <span className="text-slate-400">{email || "Not set"}</span></div>
                  <div><strong className="text-slate-300">Phone:</strong> <span className="text-slate-400">{phone || "Not set"}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Regional Settings</span>
                <div className="space-y-1 text-xs">
                  <div><strong className="text-slate-300">Timezone:</strong> <span className="text-slate-400 font-mono">{timezone}</span></div>
                  <div><strong className="text-slate-300">Currency:</strong> <span className="text-slate-400 font-mono">{currency}</span></div>
                  <div><strong className="text-slate-300">Country Code:</strong> <span className="text-slate-400 font-mono">+{defaultCountryCode}</span></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-lg font-bold text-white">{metrics.userCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Active Users</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-lg font-bold text-white">{metrics.offeringCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Catalog Items</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                <div className="text-lg font-bold text-white">{metrics.statusCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Pipeline Stages</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("PIPELINE")}
                className="text-xs"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Review
              </Button>

              <Button
                type="button"
                onClick={handleComplete}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-6 py-2 shadow-lg shadow-emerald-600/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating Workspace...
                  </>
                ) : (
                  <>
                    Complete Setup & Launch CRM <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
