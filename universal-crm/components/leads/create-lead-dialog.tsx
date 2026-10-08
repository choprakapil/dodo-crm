"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { LeadCustomFieldsInput } from "./lead-custom-fields-input";

interface CreateLeadDialogProps {
  statuses: Array<{ id: string; name: string; isDefault: boolean }>;
  sources: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  teams?: Array<{ id: string; name: string }>;
}

export function CreateLeadDialog({
  statuses,
  sources,
  users,
  teams = [],
}: CreateLeadDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [statusId, setStatusId] = useState(
    statuses.find((s) => s.isDefault)?.id || statuses[0]?.id || ""
  );
  const [sourceId, setSourceId] = useState(sources[0]?.id || "");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, any>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        priority,
        statusId: statusId || undefined,
        sourceId: sourceId || undefined,
        assignedUserId: assignedUserId || undefined,
        teamId: teamId || undefined,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      };

      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to create lead");
      }

      setIsOpen(false);
      resetForm();
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setAmount("");
    setPriority("MEDIUM");
    setStatusId(statuses.find((s) => s.isDefault)?.id || statuses[0]?.id || "");
    setSourceId(sources[0]?.id || "");
    setAssignedUserId("");
    setTeamId("");
    setCustomFields({});
    setError(null);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-xs font-medium h-9 px-3.5"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        New Lead
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lead-title"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 id="create-lead-title" className="text-base font-semibold text-slate-900">
                Create New Lead
              </h2>
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
                <Label htmlFor="lead-name" className="text-xs text-slate-700 font-medium">
                  Lead Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="lead-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                  className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 focus-visible:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-email" className="text-xs text-slate-700 font-medium">
                    Email
                  </Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-phone" className="text-xs text-slate-700 font-medium">
                    Phone
                  </Label>
                  <Input
                    id="lead-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543200"
                    className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 font-mono focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-company" className="text-xs text-slate-700 font-medium">
                    Organization / Company
                  </Label>
                  <Input
                    id="lead-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Industries"
                    className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-amount" className="text-xs text-slate-700 font-medium">
                    Deal Amount (₹)
                  </Label>
                  <Input
                    id="lead-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="50000.00"
                    className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 h-9 font-mono focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-status" className="text-xs text-slate-700 font-medium">
                    Status
                  </Label>
                  <select
                    id="lead-status"
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-900 outline-hidden focus:border-indigo-500"
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isDefault ? "(Default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-source" className="text-xs text-slate-700 font-medium">
                    Source
                  </Label>
                  <select
                    id="lead-source"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-900 outline-hidden focus:border-indigo-500"
                  >
                    <option value="">Select Source (optional)</option>
                    {sources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-priority" className="text-xs text-slate-700 font-medium">
                    Priority
                  </Label>
                  <select
                    id="lead-priority"
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
                  <Label htmlFor="lead-assignee" className="text-xs text-slate-700 font-medium">
                    Assigned User
                  </Label>
                  <select
                    id="lead-assignee"
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 text-xs text-slate-900 outline-hidden focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {teams.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="lead-team" className="text-xs text-slate-700 font-medium">
                    Team (optional)
                  </Label>
                  <select
                    id="lead-team"
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
                      Creating...
                    </>
                  ) : (
                    "Create Lead"
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
