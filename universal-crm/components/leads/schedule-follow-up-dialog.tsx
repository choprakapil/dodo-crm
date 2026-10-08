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
  users: Array<{ id: string; name: string }>;
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

  // Tomorrow 10:00 AM default
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  const dateStr = defaultDate.toISOString().split("T")[0];

  const [title, setTitle] = useState("Follow-up Call");
  const [dueDate, setDueDate] = useState(dateStr);
  const [dueTime, setDueTime] = useState("10:00");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [assignedUserId, setAssignedUserId] = useState(defaultAssigneeId || "");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const fullDueDate = `${dueDate}T${dueTime || "10:00"}:00Z`;

      const res = await fetch("/api/v1/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          title: title.trim(),
          dueDate: fullDueDate,
          priority,
          assignedUserId: assignedUserId || undefined,
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to schedule follow-up");
      }

      setIsOpen(false);
      setTitle("Follow-up Call");
      setDescription("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-8 gap-1.5 shadow-2xs"
      >
        <Clock className="h-3.5 w-3.5 text-indigo-600" />
        <span>Follow-up</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-slate-900"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <span>Schedule Follow-up for</span>
                <span className="text-indigo-600 truncate max-w-xs">{leadName}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 rounded transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">
                  Title / Goal <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Follow up on proposal discount request"
                  required
                  className="bg-slate-50/50 border-slate-200 text-xs h-8 text-slate-900 focus-visible:ring-indigo-500"
                />
              </div>

              {/* Due Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 font-medium">Due Date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 text-xs h-8 text-slate-900 focus-visible:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 font-medium">Due Time</Label>
                  <Input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="bg-slate-50/50 border-slate-200 text-xs h-8 text-slate-900 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Assignee & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-700 font-medium">Assign To</Label>
                  <select
                    value={assignedUserId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignedUserId(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-md text-xs h-8 px-2 text-slate-900 outline-hidden focus:border-indigo-500"
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
                  <Label className="text-xs text-slate-700 font-medium">Priority</Label>
                  <select
                    value={priority}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT")
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-md text-xs h-8 px-2 text-slate-900 outline-hidden focus:border-indigo-500"
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
                <Label className="text-xs text-slate-700 font-medium">Notes / Context (Optional)</Label>
                <textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Any context or checklist for this follow-up..."
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-slate-50/50 p-2 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>

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
                  size="sm"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5 font-medium shadow-xs"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
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
