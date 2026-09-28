"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Globe, Mail, Phone, Clock, DollarSign, Calendar, Loader2, CheckCircle2, AlertCircle, Users } from "lucide-react";

interface CompanyData {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  timezone: string;
  currency: string;
  dateFormat: string;
  allowSalesPriceOverride?: boolean;
  customerDirectoryVisibility?: string;
  createEnquiryHistoryEnabled?: boolean;
  historyPreviewFields?: Record<string, boolean> | null;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const COMMON_CURRENCIES = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "CAD", symbol: "$" },
  { code: "AUD", symbol: "$" },
  { code: "INR", symbol: "₹" },
  { code: "SGD", symbol: "$" },
  { code: "JPY", symbol: "¥" },
];

const DATE_FORMATS = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-09-17)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (09/17/2026)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (17/09/2026)" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY (17.09.2026)" },
];

export function CompanySettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");

  // Phase 6 settings
  const [allowSalesPriceOverride, setAllowSalesPriceOverride] = useState(true);
  const [customerDirectoryVisibility, setCustomerDirectoryVisibility] = useState<"DATA_SCOPE" | "COMPANY">("DATA_SCOPE");
  const [createEnquiryHistoryEnabled, setCreateEnquiryHistoryEnabled] = useState(true);
  const [previewFields, setPreviewFields] = useState<Record<string, boolean>>({
    customerName: true,
    previousEnquiries: true,
    productService: true,
    status: true,
    lastInteraction: true,
    quotedPrice: false,
    assignedUser: false,
  });

  useEffect(() => {
    async function loadCompany() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/v1/company/settings");
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || "Failed to load company settings");
        }
        const data: CompanyData = json.data;
        setCompany(data);
        setName(data.name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setWebsite(data.website || "");
        setLogoUrl(data.logoUrl || "");
        setTimezone(data.timezone || "UTC");
        setCurrency(data.currency || "USD");
        setDateFormat(data.dateFormat || "YYYY-MM-DD");
        setAllowSalesPriceOverride(data.allowSalesPriceOverride ?? true);
        setCustomerDirectoryVisibility((data.customerDirectoryVisibility as "DATA_SCOPE" | "COMPANY") || "DATA_SCOPE");
        setCreateEnquiryHistoryEnabled(data.createEnquiryHistoryEnabled ?? true);
        if (data.historyPreviewFields && typeof data.historyPreviewFields === "object") {
          setPreviewFields((prev) => ({ ...prev, ...(data.historyPreviewFields as Record<string, boolean>) }));
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch company details");
      } finally {
        setLoading(false);
      }
    }
    loadCompany();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const res = await fetch("/api/v1/company/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          logoUrl: logoUrl.trim() || null,
          timezone,
          currency,
          dateFormat,
          allowSalesPriceOverride,
          customerDirectoryVisibility,
          createEnquiryHistoryEnabled,
          historyPreviewFields: previewFields,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to update company settings");
      }

      setCompany(json.data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {success && (
        <div className="p-4 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-sm rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Company settings have been successfully updated.</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Basic Organization Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Organization Profile
          </CardTitle>
          <CardDescription>
            Basic organization branding and identifier information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companySlug">Tenant Identifier (Slug)</Label>
              <Input
                id="companySlug"
                value={company?.slug || ""}
                disabled
                className="bg-muted font-mono text-xs cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">
                Assigned upon organization creation. Cannot be changed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyEmail">Support / Contact Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyPhone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyPhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyWebsite">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="companyWebsite"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://acme.com"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyLogo">Logo URL</Label>
              <Input
                id="companyLogo"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://acme.com/logo.png"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Localization & Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Localization & Standards
          </CardTitle>
          <CardDescription>
            Timezone, standard currency, and date formats used across lead values, reports, and activity timestamps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Default Timezone
              </Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency" className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Default Currency
              </Label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormat" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Date Format
              </Label>
              <select
                id="dateFormat"
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {DATE_FORMATS.map((fmt) => (
                  <option key={fmt.value} value={fmt.value}>
                    {fmt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Visibility & Pricing Policy (Phase 6) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Customer Visibility & Enquiry Policies
          </CardTitle>
          <CardDescription>
            Control customer directory access, enquiry price overrides, and customer history preview governance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Customer Directory Visibility */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Customer Directory Visibility</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-lg border flex items-start space-x-3 cursor-pointer transition-colors ${
                  customerDirectoryVisibility === "DATA_SCOPE"
                    ? "bg-primary/5 border-primary text-foreground"
                    : "bg-background border-input hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="directoryVisibility"
                  value="DATA_SCOPE"
                  checked={customerDirectoryVisibility === "DATA_SCOPE"}
                  onChange={() => setCustomerDirectoryVisibility("DATA_SCOPE")}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Restricted by Data Scope (Recommended)</span>
                  <p className="text-xs text-muted-foreground">
                    Users only see customers associated with enquiries within their RBAC Data Scope (OWN, TEAM, or COMPANY).
                  </p>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-lg border flex items-start space-x-3 cursor-pointer transition-colors ${
                  customerDirectoryVisibility === "COMPANY"
                    ? "bg-primary/5 border-primary text-foreground"
                    : "bg-background border-input hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="directoryVisibility"
                  value="COMPANY"
                  checked={customerDirectoryVisibility === "COMPANY"}
                  onChange={() => setCustomerDirectoryVisibility("COMPANY")}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium">Company-wide Access</span>
                  <p className="text-xs text-muted-foreground">
                    Authorized sales users can browse and search all company customers (individual Data Scope still applies).
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Sales Price Override Policy */}
          <div className="pt-4 border-t space-y-2">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowSalesPriceOverride}
                onChange={(e) => setAllowSalesPriceOverride(e.target.checked)}
                className="mt-0.5 rounded border-input text-primary focus:ring-primary"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Allow Sales Price Override</span>
                <p className="text-xs text-muted-foreground">
                  When enabled, sales agents can customize quoted prices for offerings during enquiry creation.
                  When disabled, base offering prices are strictly locked across the tenant.
                </p>
              </div>
            </label>
          </div>

          {/* Customer History Preview Policy */}
          <div className="pt-4 border-t space-y-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={createEnquiryHistoryEnabled}
                onChange={(e) => setCreateEnquiryHistoryEnabled(e.target.checked)}
                className="mt-0.5 rounded border-input text-primary focus:ring-primary"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-medium">Allow Create Enquiry History Preview</span>
                <p className="text-xs text-muted-foreground">
                  When an agent enters an existing customer&apos;s phone number during Create Enquiry, show a sanitized history preview of prior enquiries.
                </p>
              </div>
            </label>

            {createEnquiryHistoryEnabled && (
              <div className="ml-7 p-4 bg-muted/40 rounded-lg border space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fields Allowed in History Preview
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: "customerName", label: "Customer Name" },
                    { key: "previousEnquiries", label: "Previous Enquiries Count" },
                    { key: "productService", label: "Product / Service" },
                    { key: "status", label: "Enquiry Status" },
                    { key: "lastInteraction", label: "Last Interaction Date" },
                    { key: "quotedPrice", label: "Quoted Price" },
                    { key: "assignedUser", label: "Assigned Salesperson" },
                  ].map((field) => (
                    <label key={field.key} className="flex items-center space-x-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={previewFields[field.key] ?? false}
                        onChange={(e) =>
                          setPreviewFields((prev) => ({
                            ...prev,
                            [field.key]: e.target.checked,
                          }))
                        }
                        className="rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-foreground">{field.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground italic">
                  Note: Sensitive internal notes, private management remarks, and enquiries outside the agent&apos;s Data Scope are never revealed.
                </p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
