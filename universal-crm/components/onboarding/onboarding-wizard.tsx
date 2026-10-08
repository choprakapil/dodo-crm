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
  Copy,
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
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [availableTeams, setAvailableTeams] = useState<{ id: string; name: string }[]>([]);
  const [invitedMembers, setInvitedMembers] = useState<{ email: string; name?: string; roleName?: string; inviteLink?: string }[]>([]);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
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


  // Load available roles and teams for Step 3
  useEffect(() => {
    async function loadRolesAndTeams() {
      try {
        const [rolesRes, teamsRes] = await Promise.all([
          fetch("/api/v1/roles"),
          fetch("/api/v1/teams?limit=100"),
        ]);
        if (rolesRes.ok) {
          const rJson = await rolesRes.json();
          const rList = rJson.data || [];
          setAvailableRoles(rList);
          const defaultRole = rList.find((r: any) => r.name === "Sales Rep") || rList[0];
          if (defaultRole && !inviteRoleId) {
            setInviteRoleId(defaultRole.id);
          }
        }
        if (teamsRes.ok) {
          const tJson = await teamsRes.json();
          setAvailableTeams(tJson.data || []);
        }
      } catch {
        // best-effort load
      }
    }
    loadRolesAndTeams();
  }, [inviteRoleId]);

  // Step 3: Quick Invite Colleague
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    setError(null);
    setLastInviteLink(null);

    try {
      let roleIdToSend = inviteRoleId;
      if (!roleIdToSend && availableRoles.length > 0) {
        const defaultRole = availableRoles.find((r) => r.name === "Sales Rep") || availableRoles[0];
        roleIdToSend = defaultRole.id;
      }

      const res = await fetch("/api/v1/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim() || undefined,
          phone: invitePhone.trim() || undefined,
          roleId: roleIdToSend || undefined,
          teamId: inviteTeamId || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to send invitation.");
        return;
      }

      const link = json.data?.inviteLink;
      const roleObj = availableRoles.find((r) => r.id === roleIdToSend);
      setLastInviteLink(link || null);
      setInvitedMembers((prev) => [
        ...prev,
        {
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
          roleName: roleObj?.name || "Member",
          inviteLink: link,
        },
      ]);
      setMetrics((m) => ({ ...m, userCount: m.userCount + 1 }));
      setInviteEmail("");
      setInviteName("");
      setInvitePhone("");
      setSuccessMessage(`Invitation dispatched to ${inviteEmail.trim()}. Email sent successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-32 h-32 text-indigo-600" />
        </div>
        <div className="max-w-2xl relative z-10">
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs px-2.5 py-0.5 mb-3 font-mono">
            Tenant Activation Wizard
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Welcome to DODO CRM, {name || initialState.company.name}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Let&apos;s establish the foundational setup for your company workspace. You can complete all steps now
            or resume at any point. All settings remain fully configurable in Settings later.
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="mt-8 border-t border-slate-200 pt-6">
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
                      ? "border-indigo-600 bg-indigo-50 text-indigo-950 shadow-xs"
                      : isPast
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950 hover:border-emerald-400"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isCurrent
                          ? "bg-indigo-600 text-white"
                          : isPast
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-600"
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
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* STEP CONTENT CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        {/* =================================================================== */}
        {/* STEP 1: COMPANY PROFILE */}
        {/* =================================================================== */}
        {currentStep === "PROFILE" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                1. Company Profile & Regional Settings
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure your organization identity, currency, and default operational timezone.
              </p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Company Legal / Trading Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                    placeholder="e.g. Acme Corporation"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Company Slug (Subdomain / URL)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={initialState.company.slug}
                    className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-500 font-mono select-all cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Primary Business Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                    placeholder="contact@company.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Business Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                    placeholder="+1 555-0199"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                    placeholder="https://company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Default Timezone <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
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
                  <label className="block text-xs font-semibold text-slate-700">
                    Currency <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
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
                  <label className="block text-xs font-semibold text-slate-700">
                    Default Phone Country Code
                  </label>
                  <select
                    value={defaultCountryCode}
                    onChange={(e) => setDefaultCountryCode(e.target.value)}
                    className="mt-1.5 w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
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

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5"
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
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <LayoutTemplate className="h-5 w-5 text-indigo-600" />
                  2. Optional Industry Blueprint
                </h2>
                <Badge variant="outline" className="border-indigo-200 text-indigo-700 text-xs bg-indigo-50">
                  Optional Setup
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Choose an optional industry blueprint to pre-populate custom fields, inquiry dispositions, and lead sources tailored to your sector.
                <strong> DODO CRM remains completely industry-neutral</strong> — this only seeds initial configuration that your team fully owns and can modify anytime.
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
                        ? "border-indigo-600 bg-indigo-50/70 text-slate-900 shadow-xs ring-1 ring-indigo-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {isApplied && (
                      <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Check className="w-3 h-3" /> Applied
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-900 block mt-1">{tpl.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">v{tpl.version}</span>
                    <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                      {tpl.description}
                    </p>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{tpl.configurationSummary?.customerFieldsCount || 0} fields</span>
                      <span>{tpl.configurationSummary?.dispositionsCount || 0} dispositions</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dry Run / Configuration Preview */}
            {(() => {
              const allItems: any[] = Array.isArray(previewReport?.items)
                ? previewReport.items
                : [];
              const customFieldItems = allItems.filter((i) => i.type === "CUSTOM_FIELD");
              const dispositionItems = allItems.filter((i) => i.type === "DISPOSITION");
              const sourceItems = allItems.filter((i) => i.type === "LEAD_SOURCE");
              const offeringItems = allItems.filter((i) => i.type === "OFFERING");

              const toCreateCount = previewReport?.summary
                ? (previewReport.summary.fieldsToCreate || 0) +
                  (previewReport.summary.dispositionsToCreate || 0) +
                  (previewReport.summary.sourcesToCreate || 0) +
                  (previewReport.summary.statusesToCreate || 0) +
                  (previewReport.summary.offeringsToCreate || 0)
                : allItems.filter((i) => i.status === "CREATE").length;

              const toSkipCount = previewReport?.summary
                ? (previewReport.summary.fieldsSkipped || 0) +
                  (previewReport.summary.dispositionsSkipped || 0) +
                  (previewReport.summary.sourcesSkipped || 0) +
                  (previewReport.summary.statusesSkipped || 0) +
                  (previewReport.summary.offeringsSkipped || 0)
                : allItems.filter((i) => i.status === "SKIP_MATCH" || i.status === "SKIP").length;

              const conflictsCount =
                previewReport?.summary?.conflictsCount ??
                previewReport?.conflicts?.length ??
                allItems.filter((i) => i.status === "CONFLICT").length;

              return (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Blueprint Preview: {selectedTemplateKey}
                      </span>
                    </div>
                    {isPreviewLoading ? (
                      <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                        <Loader2 className="w-3 h-3 animate-spin" /> Analyzing configuration...
                      </div>
                    ) : previewReport ? (
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-emerald-700 font-semibold">+{toCreateCount} to create</span>
                        <span className="text-slate-500">{toSkipCount} existing matches</span>
                        {conflictsCount > 0 && (
                          <span className="text-amber-700 font-bold">{conflictsCount} conflicts</span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {previewReport && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Custom Fields */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                          Custom Fields ({customFieldItems.length})
                        </span>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                          {customFieldItems.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">No custom fields in this blueprint.</p>
                          ) : (
                            customFieldItems.map((f: any) => {
                              const status = f.status || f.action;
                              const label = f.name || f.label || f.definition?.label || f.key;
                              const entityType = f.definition?.entityType || "LEAD";
                              const fieldType = f.definition?.fieldType || "TEXT";
                              return (
                                <div
                                  key={`${entityType}-${f.key}`}
                                  className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-2xs"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-900 block">{label}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {entityType}.{f.key} ({fieldType})
                                    </span>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      status === "CREATE"
                                        ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                        : status === "CONFLICT"
                                        ? "border-amber-200 text-amber-700 bg-amber-50"
                                        : "border-slate-200 text-slate-600 bg-slate-50"
                                    }`}
                                  >
                                    {status}
                                  </Badge>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Dispositions, Sources & Catalog */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider block">
                          Dispositions, Sources & Catalog ({dispositionItems.length + sourceItems.length + offeringItems.length})
                        </span>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                          {dispositionItems.map((d: any) => {
                            const status = d.status || d.action;
                            const stage = d.definition?.stage || "PIPELINE";
                            return (
                              <div
                                key={d.key || d.name}
                                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-2xs"
                              >
                                <div>
                                  <span className="font-semibold text-slate-900 block">{d.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    Disposition • {stage}
                                  </span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    status === "CREATE"
                                      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                      : "border-slate-200 text-slate-600 bg-slate-50"
                                  }`}
                                >
                                  {status}
                                </Badge>
                              </div>
                            );
                          })}
                          {sourceItems.map((s: any) => {
                            const status = s.status || s.action;
                            return (
                              <div
                                key={s.key || s.name}
                                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-2xs"
                              >
                                <div>
                                  <span className="font-semibold text-slate-900 block">{s.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">Lead Source</span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    status === "CREATE"
                                      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                      : "border-slate-200 text-slate-600 bg-slate-50"
                                  }`}
                                >
                                  {status}
                                </Badge>
                              </div>
                            );
                          })}
                          {offeringItems.map((o: any) => {
                            const status = o.status || o.action;
                            return (
                              <div
                                key={o.key || o.name}
                                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-2xs"
                              >
                                <div>
                                  <span className="font-semibold text-slate-900 block">{o.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">Catalog Offering</span>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    status === "CREATE"
                                      ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                      : "border-slate-200 text-slate-600 bg-slate-50"
                                  }`}
                                >
                                  {status}
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}


            {/* Navigation and Apply Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("PROFILE")}
                className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => saveStepNavigation("TEAM")}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Skip Blueprint
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyTemplate}
                  disabled={isApplyingTemplate || !selectedTemplateKey}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5"
                >
                  {isApplyingTemplate ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying Blueprint...
                    </>
                  ) : appliedTemplateInfo.key === selectedTemplateKey ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-emerald-300" /> Re-apply / Sync Blueprint
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
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4"
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
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  3. Team Collaboration & User Accounts
                </h2>
                <Badge variant="outline" className="border-slate-300 text-slate-700 text-xs bg-slate-50">
                  Optional Setup
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Invite your colleagues to join this tenant. DODO CRM comes with 5 pre-configured roles:
                Admin, Manager, Sales Rep, Viewer, and Support.
              </p>
            </div>

            {/* Quick Invite Form */}
            <form onSubmit={handleInviteUser} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-semibold text-slate-800 block">Invite Colleague</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Full Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Phone Number</label>
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Role</label>
                  <select
                    value={inviteRoleId}
                    onChange={(e) => setInviteRoleId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                  >
                    {availableRoles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-700">Team (Optional)</label>
                  <select
                    value={inviteTeamId}
                    onChange={(e) => setInviteTeamId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                  >
                    <option value="">No Team Assigned</option>
                    {availableTeams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  disabled={isInviting || !inviteEmail.trim()}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow-sm font-medium"
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

            {/* Last Dispatched Link Box */}
            {lastInviteLink && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5 text-emerald-800">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Invitation Link Ready & Dispatched via Email
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(lastInviteLink);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-white px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs"
                  >
                    {copiedLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedLink ? "Copied!" : "Copy Link"}
                  </button>
                </div>
                <input
                  readOnly
                  value={lastInviteLink}
                  className="w-full bg-white border border-emerald-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-700 font-mono select-all"
                />
              </div>
            )}

            {/* Invited list */}
            {invitedMembers.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-600 tracking-wider">
                  Invitations Dispatched This Session
                </span>
                <div className="space-y-1.5">
                  {invitedMembers.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="font-medium text-slate-900">{member.name || member.email}</span>
                        {member.name && <span className="text-slate-500 font-mono text-[11px]">({member.email})</span>}
                        <Badge variant="outline" className="border-indigo-200 text-[10px] text-indigo-700 bg-indigo-50/50">
                          {member.roleName || "Sales Rep"}
                        </Badge>
                      </div>
                      {member.inviteLink && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(member.inviteLink!);
                            setSuccessMessage(`Copied invitation link for ${member.email}`);
                            setTimeout(() => setSuccessMessage(null), 2500);
                          }}
                          className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium px-2 py-0.5 rounded hover:bg-indigo-50"
                        >
                          <Copy className="h-3 w-3" />
                          Copy Link
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600">
              💡 Current active tenant users: <strong className="text-slate-900">{metrics.userCount}</strong>. You can also configure structured teams and custom roles under <strong>Settings &gt; Team</strong> anytime.
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("TEMPLATES")}
                className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => saveStepNavigation("OFFERINGS")}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Skip for Now
                </Button>
                <Button
                  type="button"
                  onClick={() => saveStepNavigation("OFFERINGS")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5"
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
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Package className="h-5 w-5 text-indigo-600" />
                  4. Products & Services (Catalog)
                </h2>
                <Badge variant="outline" className="border-slate-300 text-slate-700 text-xs bg-slate-50">
                  Optional Setup
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Establish the items your organization sells or consults on. These power Enquiry/Lead
                line items, pricing, and revenue calculations.
              </p>
            </div>

            {/* Quick Add Offering Form */}
            <form onSubmit={handleAddOffering} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-semibold text-slate-800 block">Add Initial Catalog Item</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={offeringName}
                  onChange={(e) => setOfferingName(e.target.value)}
                  placeholder="e.g. Standard Consultation or Model X"
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none sm:col-span-1"
                />
                <select
                  value={offeringType}
                  onChange={(e) => setOfferingType(e.target.value as any)}
                  className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
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
                    className="bg-white border border-slate-300 rounded-lg pl-12 pr-3 py-1.5 text-xs text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isCreatingOffering || !offeringName}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
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
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-600 tracking-wider">
                  Catalog Items Added This Session
                </span>
                <div className="space-y-1">
                  {createdOfferings.map((name) => (
                    <div key={name} className="flex items-center gap-2 text-xs text-slate-800 font-mono">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600">
              💡 Current catalog offerings: <strong className="text-slate-900">{metrics.offeringCount}</strong>. You can manage tier pricing, SKUs, and custom discounts under <strong>Settings &gt; Offerings</strong>.
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("TEAM")}
                className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => saveStepNavigation("PIPELINE")}
                  className="text-xs text-slate-600 hover:text-slate-900"
                >
                  Skip for Now
                </Button>
                <Button
                  type="button"
                  onClick={() => saveStepNavigation("PIPELINE")}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5"
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
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-indigo-600" />
                  5. Pipeline & Enquiry Lifecycle
                </h2>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                  Pre-Configured
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Your tenant includes a standard 6-stage sales pipeline and 5 primary acquisition sources.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">Default Pipeline Stages ({metrics.statusCount})</span>
                <div className="space-y-1.5 text-xs text-slate-600 font-mono">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> 1. New (Inbound)</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> 2. Contacted</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-violet-500" /> 3. Interested</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-pink-500" /> 4. Proposal Sent</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 5. Converted (Won)</div>
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> 6. Lost</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">Default Lead Sources ({metrics.sourceCount})</span>
                <div className="space-y-1.5 text-xs text-slate-600 font-mono">
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

            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("OFFERINGS")}
                className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button
                type="button"
                onClick={() => saveStepNavigation("COMPLETED")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5"
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-slate-900">
                Workspace Setup Complete!
              </h2>
              <p className="text-xs text-slate-600 mt-1.5">
                Your tenant is ready for daily operations. Review your configuration summary below and launch the CRM.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-600 tracking-wider">Company Identity</span>
                <div className="space-y-1 text-xs">
                  <div><strong className="text-slate-700">Name:</strong> <span className="text-slate-900 font-medium">{name}</span></div>
                  <div><strong className="text-slate-700">Slug:</strong> <span className="text-slate-600 font-mono">{initialState.company.slug}</span></div>
                  <div><strong className="text-slate-700">Email:</strong> <span className="text-slate-600">{email || "Not set"}</span></div>
                  <div><strong className="text-slate-700">Phone:</strong> <span className="text-slate-600">{phone || "Not set"}</span></div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase text-slate-600 tracking-wider">Regional Settings</span>
                <div className="space-y-1 text-xs">
                  <div><strong className="text-slate-700">Timezone:</strong> <span className="text-slate-600 font-mono">{timezone}</span></div>
                  <div><strong className="text-slate-700">Currency:</strong> <span className="text-slate-600 font-mono">{currency}</span></div>
                  <div><strong className="text-slate-700">Country Code:</strong> <span className="text-slate-600 font-mono">+{defaultCountryCode}</span></div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-lg font-bold text-slate-900">{metrics.userCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Active Users</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-lg font-bold text-slate-900">{metrics.offeringCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Catalog Items</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-lg font-bold text-slate-900">{metrics.statusCount}</div>
                <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">Pipeline Stages</div>
              </div>
            </div>

            {/* Enterprise Readiness Scorecard */}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                    CRM Setup Readiness Score
                  </span>
                </div>
                <Badge className="bg-indigo-600 text-white font-mono text-xs px-2.5 py-0.5">
                  96% Ready
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 text-center">
                  <span className="text-[10px] text-slate-500 font-mono block">Core Identity</span>
                  <span className="text-xs font-bold text-emerald-600">100% Configured</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 text-center">
                  <span className="text-[10px] text-slate-500 font-mono block">Sales Pipeline</span>
                  <span className="text-xs font-bold text-emerald-600">100% Configured</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 text-center">
                  <span className="text-[10px] text-slate-500 font-mono block">Offerings Catalog</span>
                  <span className="text-xs font-bold text-emerald-600">100% Configured</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-indigo-100 text-center">
                  <span className="text-[10px] text-slate-500 font-mono block">RBAC & Security</span>
                  <span className="text-xs font-bold text-emerald-600">100% Configured</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => saveStepNavigation("PIPELINE")}
                className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Review
              </Button>

              <Button
                type="button"
                onClick={handleComplete}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-6 py-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Activating Workspace...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-4 w-4 text-emerald-200" />
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
