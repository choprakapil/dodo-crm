"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  User,
  Package,
  DollarSign,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Building,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LeadCustomFieldsInput } from "@/components/leads/lead-custom-fields-input";

export interface CreateEnquiryFormProps {
  statuses: Array<{ id: string; name: string; color: string; isDefault: boolean }>;
  sources: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  teams: Array<{ id: string; name: string }>;
  offerings?: Array<{
    id: string;
    name: string;
    type: "PRODUCT" | "SERVICE";
    code?: string | null;
    defaultPrice: any;
    currency: string;
    allowSalesPriceOverride: boolean;
  }>;
  tenantAllowSalesPriceOverride?: boolean;
  onSuccess?: (leadId: string) => void;
  isDialog?: boolean;
}

interface ResolvedCustomerState {
  id: string;
  name: string;
  displayName?: string | null;
  companyName?: string | null;
  phone?: string;
  previousEnquiriesCount?: number;
}

interface HistoryPreviewItem {
  id: string;
  createdAt: string;
  lastInteractionAt?: string;
  status?: { name: string; color: string } | null;
  offering?: { name: string; type: string } | null;
  quotedPrice?: string;
  assignedUser?: { name: string };
}

export function CreateEnquiryForm({
  statuses,
  sources,
  users,
  teams,
  offerings = [],
  tenantAllowSalesPriceOverride = true,
  onSuccess,
  isDialog = false,
}: CreateEnquiryFormProps) {
  const router = useRouter();

  // Step 1: Customer Phone & Resolution
  const [phone, setPhone] = useState("");
  const [resolvingPhone, setResolvingPhone] = useState(false);
  const [resolvedCustomer, setResolvedCustomer] = useState<ResolvedCustomerState | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryPreviewItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);

  // Customer profile fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");

  // Step 2: Offering & Price
  const [offeringId, setOfferingId] = useState("");
  const [selectedOffering, setSelectedOffering] = useState<(typeof offerings)[0] | null>(null);
  const [quotedPrice, setQuotedPrice] = useState("");
  const [priceOverrideReason, setPriceOverrideReason] = useState("");

  // Step 3: Enquiry Details
  const defaultStatus = statuses.find((s) => s.isDefault)?.id || statuses[0]?.id || "";
  const [statusId, setStatusId] = useState(defaultStatus);
  const [sourceId, setSourceId] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  // Step 4: Assignment
  const [assignedUserId, setAssignedUserId] = useState("");
  const [teamId, setTeamId] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if price override is permitted for selected offering
  const isOverrideAllowed =
    tenantAllowSalesPriceOverride && (selectedOffering?.allowSalesPriceOverride ?? true);

  // Phone resolution effect
  useEffect(() => {
    const cleaned = phone.trim();
    if (cleaned.length < 8) {
      setResolvedCustomer(null);
      setIsNewCustomer(false);
      setShowHistory(false);
      return;
    }

    const timer = setTimeout(async () => {
      setResolvingPhone(true);
      try {
        const res = await fetch(`/api/v1/customers/resolve?phone=${encodeURIComponent(cleaned)}`);
        const json = await res.json();
        if (res.ok && json.success && json.data) {
          const cust = json.data;
          setResolvedCustomer({
            id: cust.id,
            name: cust.name,
            displayName: cust.displayName,
            companyName: cust.companyName,
            previousEnquiriesCount: cust._count?.enquiries ?? 0,
          });
          setIsNewCustomer(false);
          if (!name.trim()) {
            setName(cust.name);
          }
          if (!company.trim() && cust.companyName) {
            setCompany(cust.companyName);
          }
        } else {
          setResolvedCustomer(null);
          setIsNewCustomer(true);
        }
      } catch {
        setResolvedCustomer(null);
        setIsNewCustomer(true);
      } finally {
        setResolvingPhone(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [phone]);

  // Load history preview when requested
  const handleToggleHistory = async () => {
    if (!resolvedCustomer) return;
    if (!showHistory && historyItems.length === 0) {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/v1/customers/${resolvedCustomer.id}/history-preview`);
        const json = await res.json();
        if (res.ok && json.success && json.data?.allowed) {
          setHistoryItems(json.data.enquiries || []);
          setHistoryTotal(json.data.totalAuthorizedEnquiries || 0);
        }
      } catch (err) {
        console.error("Failed to load customer history preview", err);
      } finally {
        setLoadingHistory(false);
      }
    }
    setShowHistory(!showHistory);
  };

  // When offering selection changes
  const handleOfferingChange = (id: string) => {
    setOfferingId(id);
    const found = offerings.find((o) => o.id === id) || null;
    setSelectedOffering(found);
    if (found) {
      setQuotedPrice(String(found.defaultPrice));
    } else {
      setQuotedPrice("");
    }
    setPriceOverrideReason("");
  };

  const isPriceModified =
    selectedOffering &&
    quotedPrice !== "" &&
    Math.abs(parseFloat(quotedPrice) - Number(selectedOffering.defaultPrice)) > 0.001;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Customer name is required");
      return;
    }

    if (isPriceModified && !isOverrideAllowed) {
      setError("Sales price override is locked by organization policy for this offering");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        company: company.trim() || undefined,
        priority,
        statusId: statusId || undefined,
        sourceId: sourceId || undefined,
        assignedUserId: assignedUserId || undefined,
        teamId: teamId || undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      };

      if (resolvedCustomer) {
        payload.customerId = resolvedCustomer.id;
      }

      if (offeringId) {
        payload.offeringId = offeringId;
        if (quotedPrice) {
          payload.quotedPrice = parseFloat(quotedPrice);
        }
        if (isPriceModified && priceOverrideReason.trim()) {
          payload.priceOverrideReason = priceOverrideReason.trim();
        }
      }

      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to create enquiry");
      }

      const createdId = json.data?.id;
      if (onSuccess) {
        onSuccess(createdId);
      } else {
        router.push(`/app/leads/${createdId}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create enquiry");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 rounded-md text-xs flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* SECTION 1: Customer Identity & Resolution */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Customer Identification</h3>
          </div>
          {resolvingPhone && (
            <span className="text-[11px] text-slate-400 flex items-center">
              <Loader2 className="h-3 w-3 animate-spin mr-1 text-indigo-400" />
              Resolving customer...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs text-slate-300">
              Phone Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-slate-100 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs text-slate-300">
              Customer Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-800 border-slate-700 text-slate-100 text-xs"
            />
          </div>
        </div>

        {/* Existing Customer Detected Card */}
        {resolvedCustomer && (
          <div className="bg-emerald-950/30 border border-emerald-800/80 rounded-lg p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-300">
                  Existing Customer Recognized: {resolvedCustomer.name}
                </span>
                {resolvedCustomer.companyName && (
                  <span className="text-[11px] text-emerald-400/80 font-normal">
                    ({resolvedCustomer.companyName})
                  </span>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleHistory}
                className="h-7 text-[11px] bg-emerald-900/40 border-emerald-700 text-emerald-200 hover:bg-emerald-800/50"
              >
                {showHistory ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Hide History
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    View Allowed History ({resolvedCustomer.previousEnquiriesCount ?? 0})
                  </>
                )}
              </Button>
            </div>

            {/* Expandable History Preview */}
            {showHistory && (
              <div className="mt-3 pt-3 border-t border-emerald-800/60 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                    Filtered by Admin Policy & Your Data Scope
                  </span>
                  <span>{historyTotal} authorized enquiry records</span>
                </div>

                {loadingHistory ? (
                  <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span>Loading authorized history...</span>
                  </div>
                ) : historyItems.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    No authorized previous enquiries found under your data scope.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {historyItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950/80 border border-slate-800 rounded p-2 text-xs flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-slate-200">
                              {item.offering?.name || "Enquiry"}
                            </span>
                            {item.status && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1.5"
                                style={{ borderColor: item.status.color, color: item.status.color }}
                              >
                                {item.status.name}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                            {item.assignedUser && (
                              <span>• Assigned: {item.assignedUser.name}</span>
                            )}
                          </div>
                        </div>

                        {item.quotedPrice && (
                          <span className="font-mono text-xs text-slate-300">
                            ₹{Number(item.quotedPrice).toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isNewCustomer && (
          <div className="text-[11px] text-sky-400 bg-sky-950/30 border border-sky-800/60 rounded px-2.5 py-1.5 flex items-center space-x-1.5">
            <span>✨ New customer will be created and linked to this enquiry automatically.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-slate-300">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-slate-100 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company" className="text-xs text-slate-300">
              Organization / Company
            </Label>
            <div className="relative">
              <Building className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                id="company"
                placeholder="Customer's organization"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="pl-9 bg-slate-800 border-slate-700 text-slate-100 text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Product / Service & Governed Pricing */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
          <Package className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Offering & Pricing Governance</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="offeringSelect" className="text-xs text-slate-300">
              Product or Service
            </Label>
            <select
              id="offeringSelect"
              value={offeringId}
              onChange={(e) => handleOfferingChange(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Select Product or Service --</option>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  [{o.type === "PRODUCT" ? "Product" : "Service"}] {o.name} {o.code ? `(${o.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="quotedPrice" className="text-xs text-slate-300">
                Quoted Price {selectedOffering?.currency ? `(${selectedOffering.currency})` : ""}
              </Label>
              {selectedOffering && (
                <span className="text-[10px] text-slate-400">
                  Base: {selectedOffering.currency} {Number(selectedOffering.defaultPrice).toLocaleString()}
                </span>
              )}
            </div>

            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                id="quotedPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(e.target.value)}
                disabled={Boolean(selectedOffering && !isOverrideAllowed)}
                className={`pl-9 text-xs font-mono ${
                  selectedOffering && !isOverrideAllowed
                    ? "bg-slate-950/60 border-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
              {selectedOffering && (
                <div className="absolute right-3 top-2.5">
                  {isOverrideAllowed ? (
                    <span className="text-[10px] text-emerald-400 flex items-center">
                      <Unlock className="h-3 w-3 mr-1" />
                      Override allowed
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 flex items-center" title="Price locked by admin policy">
                      <Lock className="h-3 w-3 mr-1" />
                      Locked
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reason for price override if salesperson altered price */}
        {isPriceModified && isOverrideAllowed && (
          <div className="space-y-1.5 p-3 bg-amber-950/20 border border-amber-800/60 rounded-md">
            <Label htmlFor="priceOverrideReason" className="text-xs text-amber-300">
              Price Override Reason <span className="text-slate-400 font-normal">(Audited)</span>
            </Label>
            <Input
              id="priceOverrideReason"
              placeholder="e.g. Approved bulk discount, promotional seasonal rate..."
              value={priceOverrideReason}
              onChange={(e) => setPriceOverrideReason(e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-100 text-xs"
            />
          </div>
        )}
      </div>

      {/* SECTION 3: Enquiry Details & Dynamic Fields */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2">
          Enquiry Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="statusSelect" className="text-xs text-slate-300">
              Initial Status
            </Label>
            <select
              id="statusSelect"
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sourceSelect" className="text-xs text-slate-300">
              Lead Source
            </Label>
            <select
              id="sourceSelect"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Select Source --</option>
              {sources.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prioritySelect" className="text-xs text-slate-300">
              Priority
            </Label>
            <select
              id="prioritySelect"
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className="w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
        </div>

        {/* Dynamic Custom Fields */}
        <div className="pt-2">
          <LeadCustomFieldsInput
            values={customFields}
            onChange={setCustomFields}
          />
        </div>
      </div>

      {/* SECTION 4: Assignment */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-white border-b border-slate-800 pb-2">
          Ownership & Assignment
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="assignUser" className="text-xs text-slate-300">
              Assign Salesperson
            </Label>
            <select
              id="assignUser"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- Unassigned --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assignTeam" className="text-xs text-slate-300">
              Assign Team
            </Label>
            <select
              id="assignTeam"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- No Team --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-5 shadow-sm"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Enquiry
        </Button>
      </div>
    </form>
  );
}
