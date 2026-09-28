"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit2, Loader2, AlertCircle } from "lucide-react";
import { LeadCustomFieldsInput } from "@/components/leads/lead-custom-fields-input";

interface EditLeadDialogProps {
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    amount: number | string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    sourceId: string | null;
    teamId: string | null;
  };
  sources: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  onUpdated?: () => void;
}

export function EditLeadDialog({
  lead,
  sources,
  teams,
  onUpdated,
}: EditLeadDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(lead.name);
  const [email, setEmail] = useState(lead.email || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [company, setCompany] = useState(lead.company || "");
  const [amount, setAmount] = useState(lead.amount ? String(lead.amount) : "");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">(lead.priority);
  const [sourceId, setSourceId] = useState(lead.sourceId || "");
  const [teamId, setTeamId] = useState(lead.teamId || "");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  const handleOpen = async () => {
    setIsOpen(true);
    try {
      const res = await fetch(`/api/v1/leads/${lead.id}/custom-fields`);
      if (res.ok) {
        const json = await res.json();
        const initialMap: Record<string, unknown> = {};
        for (const item of json.data || []) {
          if (item.value !== null && item.value !== undefined) {
            initialMap[item.field.key] = item.value;
          }
        }
        setCustomFields(initialMap);
      }
    } catch {
      // Ignore
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          company: company.trim() || null,
          amount: amount ? parseFloat(amount) : null,
          priority,
          sourceId: sourceId || null,
          teamId: teamId || null,
          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to update lead");
        setIsLoading(false);
        return;
      }

      setIsOpen(false);
      onUpdated?.();
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

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
        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10"
        title="Edit Lead"
      >
        <Edit2 className="h-3.5 w-3.5" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-white">Edit Lead Details</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs text-slate-300">
                  Lead Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email" className="text-xs text-slate-300">
                    Email
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone" className="text-xs text-slate-300">
                    Phone
                  </Label>
                  <Input
                    id="edit-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-company" className="text-xs text-slate-300">
                    Organization / Company
                  </Label>
                  <Input
                    id="edit-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-amount" className="text-xs text-slate-300">
                    Deal Amount ($)
                  </Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-priority" className="text-xs text-slate-300">
                    Priority
                  </Label>
                  <select
                    id="edit-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT")}
                    className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-source" className="text-xs text-slate-300">
                    Source
                  </Label>
                  <select
                    id="edit-source"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
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
                  <Label htmlFor="edit-team" className="text-xs text-slate-300">
                    Team (optional)
                  </Label>
                  <select
                    id="edit-team"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="border-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white"
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
