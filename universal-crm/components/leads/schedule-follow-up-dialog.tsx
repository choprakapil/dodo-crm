"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Loader2, AlertCircle } from "lucide-react";

interface ScheduleFollowUpDialogProps {
  leadId: string;
  leadName: string;
  users: Array<{ id: string; name: string; email: string }>;
  defaultAssigneeId?: string | null;
}

export function ScheduleFollowUpDialog({
  leadId,
  leadName,
  users,
  defaultAssigneeId,
}: ScheduleFollowUpDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("10:00");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [assignedUserId, setAssignedUserId] = useState(defaultAssigneeId || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title for the follow-up.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let dueAt: string | undefined = undefined;
      if (dueDate) {
        dueAt = new Date(`${dueDate}T${dueTime || "00:00"}:00`).toISOString();
      }

      const res = await fetch("/api/v1/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          title: title.trim(),
          description: description.trim() || undefined,
          dueAt,
          priority,
          assignedUserId: assignedUserId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to schedule follow-up");
      }

      setIsOpen(false);
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs h-8 gap-1.5"
      >
        <Clock className="h-3.5 w-3.5 text-blue-400" />
        <span>Follow-up</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-slate-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span>Schedule Follow-up for</span>
                <span className="text-blue-400 truncate max-w-xs">{leadName}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  Title / Goal <span className="text-rose-400">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Follow up on proposal discount request"
                  required
                  className="bg-slate-900/80 border-slate-800 text-xs h-8 text-white focus-visible:ring-indigo-500"
                />
              </div>

              {/* Due Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-slate-900/80 border-slate-800 text-xs h-8 text-white focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Due Time</Label>
                  <Input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="bg-slate-900/80 border-slate-800 text-xs h-8 text-white focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Assignee & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Assign To</Label>
                  <select
                    value={assignedUserId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignedUserId(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-md text-xs h-8 px-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Priority</Label>
                  <select
                    value={priority}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT")
                    }
                    className="w-full bg-slate-900/80 border border-slate-800 rounded-md text-xs h-8 px-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Description / Instructions */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Notes / Context (Optional)</Label>
                <textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Any context or checklist for this follow-up..."
                  rows={3}
                  className="w-full rounded-md border border-slate-800 bg-slate-900/80 p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 gap-1.5 font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <span>Schedule Follow-up</span>
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
