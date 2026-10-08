"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2, Loader2, AlertCircle } from "lucide-react";
import { LeadCustomFieldsInput } from "./lead-custom-fields-input";

interface EditLeadDialogProps {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    amount: any;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    sourceId: string | null;
    teamId: string | null;
  };
  sources: Array<{ id: string; name: string }>;
  teams?: Array<{ id: string; name: string }>;
}

export function EditLeadDialog({ lead, sources, teams = [] }: EditLeadDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state initialized from props
  const [name, setName] = useState(lead.name);
  const [email, setEmail] = useState(lead.email || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [company, setCompany] = useState(lead.company || "");
  const [amount, setAmount] = useState(lead.amount ? String(lead.amount) : "");
  const [priority, setPriority] = useState(lead.priority);
  const [sourceId, setSourceId] = useState(lead.sourceId || "");
  const [teamId, setTeamId] = useState(lead.teamId || "");
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  const handleOpen = async () => {
    setIsOpen(true);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}/custom-fields`);
      const data = await res.json();
      if (data.success && data.data) {
        setCustomFields(data.data);
      }
    } catch {
      // Quiet fail if custom fields couldn't load initially
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        amount: amount ? parseFloat(amount) : null,
        priority,
        sourceId: sourceId || null,
        teamId: teamId || null,
      };

      // 1. Update core lead record
      const res = await fetch(`/api/v1/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update lead");
      }

      // 2. Update custom field values if present
      if (Object.keys(customFields).length > 0) {
        const cfRes = await fetch(`/api/v1/leads/${lead.id}/custom-fields`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customFields }),
        });
        const cfData = await cfRes.json();
        if (!cfRes.ok || !cfData.success) {
          throw new Error(cfData.error?.message || "Lead updated, but custom fields failed to save.");
        }
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setName(lead.name);
          setEmail(lead.email || "");
          setPhone(lead.phone || "");
          setCompany(lead.company || "");
          setAmount(lead.amount ? String(lead.amount) : "");
          setPriority(lead.priority);
          setSourceId(lead.sourceId || "");
          setTeamId(lead.teamId || "");
          setError(null);
          handleOpen();
        }}
        className="h-8 w-8 p-0 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
        title="Edit Lead"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">Edit Lead Details</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 rounded transition"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs text-slate-700 font-medium">
                  Lead Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email" className="text-xs text-slate-700 font-medium">
                    Email
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone" className="text-xs text-slate-700 font-medium">
                    Phone
                  </Label>
                  <Input
                    id="edit-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 font-mono focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-company" className="text-xs text-slate-700 font-medium">
                    Organization / Company
                  </Label>
                  <Input
                    id="edit-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-amount" className="text-xs text-slate-700 font-medium">
                    Deal Amount (₹)
                  </Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 font-mono focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-priority" className="text-xs text-slate-700 font-medium">
                    Priority
                  </Label>
                  <select
                    id="edit-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT")}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-900 outline-hidden focus:border-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-source" className="text-xs text-slate-700 font-medium">
                    Source
                  </Label>
                  <select
                    id="edit-source"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-900 outline-hidden focus:border-indigo-500"
                  >
                    <option value="">No Source</option>
                    {sources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {teams.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-team" className="text-xs text-slate-700 font-medium">
                    Team (optional)
                  </Label>
                  <select
                    id="edit-team"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-900 outline-hidden focus:border-indigo-500"
                  >
                    <option value="">No Team Assigned</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Custom Fields */}
              <LeadCustomFieldsInput
                values={customFields}
                onChange={setCustomFields}
                disabled={isLoading}
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-medium shadow-xs"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
