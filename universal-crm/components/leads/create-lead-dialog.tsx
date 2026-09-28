"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { LeadCustomFieldsInput } from "@/components/leads/lead-custom-fields-input";

interface CreateLeadDialogProps {
  statuses: Array<{ id: string; name: string; color: string; isDefault: boolean }>;
  sources: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; email: string }>;
  teams: Array<{ id: string; name: string }>;
}

export function CreateLeadDialog({
  statuses,
  sources,
  users,
  teams,
}: CreateLeadDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  
  // Default status
  const defaultStatus = statuses.find((s) => s.isDefault)?.id || statuses[0]?.id || "";
  const [statusId, setStatusId] = useState(defaultStatus);
  const [sourceId, setSourceId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setAmount("");
    setPriority("MEDIUM");
    setStatusId(defaultStatus);
    setSourceId("");
    setAssignedUserId("");
    setTeamId("");
    setCustomFields({});
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Lead name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "Failed to create lead");
        setIsLoading(false);
        return;
      }

      resetForm();
      setIsOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => {
          resetForm();
          setIsOpen(true);
        }}
        className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 text-xs font-semibold h-9 px-3.5"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        New Lead
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lead-title"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 id="create-lead-title" className="text-base font-semibold text-white">
                Create New Lead
              </h2>
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
                <Label htmlFor="lead-name" className="text-xs text-slate-300">
                  Lead Name <span className="text-rose-400">*</span>
                </Label>
                <Input
                  id="lead-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  required
                  className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-email" className="text-xs text-slate-300">
                    Email
                  </Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-phone" className="text-xs text-slate-300">
                    Phone
                  </Label>
                  <Input
                    id="lead-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-company" className="text-xs text-slate-300">
                    Organization / Company
                  </Label>
                  <Input
                    id="lead-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Industries"
                    className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lead-amount" className="text-xs text-slate-300">
                    Deal Amount ($)
                  </Label>
                  <Input
                    id="lead-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="5000.00"
                    className="bg-slate-950 border-slate-800 text-xs text-slate-100 h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-status" className="text-xs text-slate-300">
                    Status
                  </Label>
                  <select
                    id="lead-status"
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                  >
                    {statuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.isDefault ? "(Default)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-source" className="text-xs text-slate-300">
                    Source
                  </Label>
                  <select
                    id="lead-source"
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
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
                  <Label htmlFor="lead-priority" className="text-xs text-slate-300">
                    Priority
                  </Label>
                  <select
                    id="lead-priority"
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
                  <Label htmlFor="lead-assignee" className="text-xs text-slate-300">
                    Assigned User
                  </Label>
                  <select
                    id="lead-assignee"
                    value={assignedUserId}
                    onChange={(e) => setAssignedUserId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
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
                  <Label htmlFor="lead-team" className="text-xs text-slate-300">
                    Team (optional)
                  </Label>
                  <select
                    id="lead-team"
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
