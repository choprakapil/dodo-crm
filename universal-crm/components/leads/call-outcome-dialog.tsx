"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Loader2, PhoneCall, Ban } from "lucide-react";

interface DispositionItem {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  color: string | null;
  isTerminal: boolean;
  requiresFollowUp: boolean;
  followUpMandatory: boolean;
  allowsClose: boolean;
  allowsConvert: boolean;
  cancelActiveFollowUp: boolean;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface CallOutcomeDialogProps {
  leadId: string;
  leadName: string;
  dispositions: DispositionItem[];
  users: UserOption[];
  defaultAssigneeId?: string | null;
}

export function CallOutcomeDialog({
  leadId,
  leadName,
  dispositions,
  users,
  defaultAssigneeId,
}: CallOutcomeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [dispositionId, setDispositionId] = useState("");
  const [notes, setNotes] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("10:00");
  const [followUpReason, setFollowUpReason] = useState("");
  const [assignedUserId, setAssignedUserId] = useState(defaultAssigneeId || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDisposition = dispositions.find((d) => d.id === dispositionId);

  const handleDispositionChange = (id: string) => {
    setDispositionId(id);
    const selected = dispositions.find((d) => d.id === id);
    if (selected) {
      if (selected.followUpMandatory) {
        setScheduleFollowUp(true);
        if (!followUpDate) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          setFollowUpDate(tomorrow.toISOString().split("T")[0]);
        }
      } else if (selected.requiresFollowUp) {
        setScheduleFollowUp(true);
      } else if (selected.cancelActiveFollowUp) {
        setScheduleFollowUp(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispositionId) {
      setError("Please select a call disposition");
      return;
    }

    if (selectedDisposition?.followUpMandatory && (!followUpDate || !followUpTime)) {
      setError(`Disposition "${selectedDisposition.name}" mandates scheduling a follow-up date and time.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let dueAt: string | null = null;
      if (scheduleFollowUp && followUpDate) {
        const combined = new Date(`${followUpDate}T${followUpTime || "10:00"}:00`);
        if (isNaN(combined.getTime())) {
          throw new Error("Invalid follow-up date/time format");
        }
        dueAt = combined.toISOString();
      }

      const durationSeconds = durationMinutes ? Math.round(Number(durationMinutes) * 60) : null;

      const payload = {
        dispositionId,
        notes: notes.trim() || null,
        durationSeconds,
        dueAt,
        followUpReason: followUpReason.trim() || null,
        assignedUserId: assignedUserId || null,
      };

      const res = await fetch(`/api/v1/leads/${leadId}/call-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to log call outcome");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
      >
        <PhoneCall className="h-3.5 w-3.5" />
        <span>Log Call Outcome</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-emerald-500" />
              Log Call Outcome: {leadName}
            </DialogTitle>
            <DialogDescription>
              Record call details, update lead disposition, and manage automated follow-up lifecycle.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && (
              <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Disposition Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="call-disposition">Call Disposition *</Label>
              <select
                id="call-disposition"
                value={dispositionId}
                onChange={(e) => handleDispositionChange(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                required
              >
                <option value="">— Select Call Outcome —</option>
                {dispositions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {"—".repeat(d.depth)} {d.name}
                    {d.followUpMandatory ? " (Mandatory Follow-Up)" : ""}
                    {d.cancelActiveFollowUp ? " (Cancels Follow-Ups)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Disposition Info Banner */}
            {selectedDisposition && (
              <div className="p-3 bg-muted/40 border rounded-lg flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground font-medium">Outcome rules:</span>
                {selectedDisposition.followUpMandatory && (
                  <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                    <Clock className="h-3 w-3" /> Mandatory Follow-Up
                  </Badge>
                )}
                {selectedDisposition.cancelActiveFollowUp && (
                  <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] gap-1">
                    <Ban className="h-3 w-3" /> Active Follow-Ups Will Be Cancelled
                  </Badge>
                )}
                {selectedDisposition.isTerminal && (
                  <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px]">
                    Terminal Disposition
                  </Badge>
                )}
                {!selectedDisposition.allowsClose && (
                  <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-[10px]">
                    Blocks Close
                  </Badge>
                )}
              </div>
            )}

            {/* Call Duration & Notes */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-1">
                <Label htmlFor="call-duration">Duration (minutes)</Label>
                <Input
                  id="call-duration"
                  type="number"
                  step="0.5"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="call-notes">Call Notes / Summary</Label>
                <Input
                  id="call-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Summary of customer conversation..."
                />
              </div>
            </div>

            {/* Follow-up Section */}
            {!selectedDisposition?.cancelActiveFollowUp && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="schedule-toggle" className="text-sm font-semibold">
                      Schedule Next Follow-Up Touchpoint
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {selectedDisposition?.followUpMandatory
                        ? "Mandatory: The existing active follow-up will be rescheduled or a new one created."
                        : "Reschedules existing active follow-up or creates a new touchpoint."}
                    </p>
                  </div>
                  <input
                    id="schedule-toggle"
                    type="checkbox"
                    checked={scheduleFollowUp || !!selectedDisposition?.followUpMandatory}
                    disabled={selectedDisposition?.followUpMandatory}
                    onChange={(e) => setScheduleFollowUp(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>

                {(scheduleFollowUp || selectedDisposition?.followUpMandatory) && (
                  <div className="bg-muted/30 p-3.5 rounded-lg border space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="fu-date" className="text-xs">
                          Follow-Up Date *
                        </Label>
                        <Input
                          id="fu-date"
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          required={selectedDisposition?.followUpMandatory}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="fu-time" className="text-xs">
                          Follow-Up Time
                        </Label>
                        <Input
                          id="fu-time"
                          type="time"
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="fu-reason" className="text-xs">
                          Touchpoint Reason / Agenda
                        </Label>
                        <Input
                          id="fu-reason"
                          value={followUpReason}
                          onChange={(e) => setFollowUpReason(e.target.value)}
                          placeholder="e.g. Discuss revised proposal"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="fu-assignee" className="text-xs">
                          Assignee
                        </Label>
                        <select
                          id="fu-assignee"
                          value={assignedUserId}
                          onChange={(e) => setAssignedUserId(e.target.value)}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                        >
                          <option value="">— Current User / Lead Owner —</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Call Outcome
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
