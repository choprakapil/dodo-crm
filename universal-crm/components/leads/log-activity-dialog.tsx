"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Phone, MessageSquare, Mail, FileText, Calendar, Loader2 } from "lucide-react";

interface LogActivityDialogProps {
  leadId: string;
  leadName: string;
}

export function LogActivityDialog({ leadId, leadName }: LogActivityDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"CALL" | "WHATSAPP" | "EMAIL" | "NOTE" | "MEETING">("CALL");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const activityOptions = [
    { type: "CALL", label: "Call", icon: Phone, color: "text-emerald-400" },
    { type: "WHATSAPP", label: "WhatsApp", icon: MessageSquare, color: "text-green-400" },
    { type: "EMAIL", label: "Email", icon: Mail, color: "text-sky-400" },
    { type: "NOTE", label: "Note", icon: FileText, color: "text-amber-400" },
    { type: "MEETING", label: "Meeting", icon: Calendar, color: "text-violet-400" },
  ] as const;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please enter details or notes for this activity.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/leads/${leadId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject: subject.trim() || undefined,
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to record activity");
      }

      setIsOpen(false);
      setSubject("");
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
        <PlusCircle className="h-3.5 w-3.5 text-indigo-400" />
        <span>Activity</span>
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
                <span>Log Activity for</span>
                <span className="text-indigo-400 truncate max-w-xs">{leadName}</span>
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
                <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg">
                  {error}
                </div>
              )}

              {/* Activity Type Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Activity Type</Label>
                <div className="grid grid-cols-5 gap-1.5">
                  {activityOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = type === opt.type;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => setType(opt.type)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-[11px] transition ${
                          isSelected
                            ? "bg-indigo-600/20 border-indigo-500/50 text-white font-medium"
                            : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                        }`}
                      >
                        <Icon className={`h-4 w-4 mb-1 ${isSelected ? opt.color : "text-slate-400"}`} />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject / Title */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Subject / Summary (Optional)</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Intro call regarding enterprise pricing"
                  className="bg-slate-900/80 border-slate-800 text-xs h-8 text-white focus-visible:ring-indigo-500"
                />
              </div>

              {/* Description / Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">
                  Details / Notes <span className="text-rose-400">*</span>
                </Label>
                <textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Key discussion points, outcomes, next steps..."
                  rows={4}
                  required
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
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 gap-1.5 font-medium"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Activity</span>
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
