"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PhoneCall,
  Mail,
  Calendar,
  FileText,
  MessageSquare,
  Loader2,
  PlusCircle,
} from "lucide-react";

interface LogActivityDialogProps {
  leadId: string;
  leadName: string;
}

type ActivityType = "CALL" | "EMAIL" | "MEETING" | "NOTE" | "WHATSAPP";

const activityOptions: Array<{
  type: ActivityType;
  label: string;
  icon: any;
  color: string;
}> = [
  { type: "CALL", label: "Phone Call", icon: PhoneCall, color: "text-emerald-600" },
  { type: "EMAIL", label: "Email", icon: Mail, color: "text-sky-600" },
  { type: "MEETING", label: "Meeting", icon: Calendar, color: "text-purple-600" },
  { type: "WHATSAPP", label: "WhatsApp", icon: MessageSquare, color: "text-green-600" },
  { type: "NOTE", label: "Internal Note", icon: FileText, color: "text-amber-600" },
];

export function LogActivityDialog({ leadId, leadName }: LogActivityDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<ActivityType>("CALL");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Activity details are required.");
      return;
    }

    setIsLoading(true);
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

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to log activity");
      }

      setIsOpen(false);
      setSubject("");
      setDescription("");
      setType("CALL");
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
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-8 gap-1.5 shadow-2xs"
      >
        <PlusCircle className="h-3.5 w-3.5 text-indigo-600" />
        <span>Activity</span>
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
                <span>Log Activity for</span>
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
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                  {error}
                </div>
              )}

              {/* Activity Type Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">Activity Type</Label>
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
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold shadow-2xs"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
                <Label className="text-xs text-slate-700 font-medium">Subject / Summary (Optional)</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Intro call regarding enterprise pricing"
                  className="bg-slate-50/50 border-slate-200 text-xs h-8 text-slate-900 focus-visible:ring-indigo-500"
                />
              </div>

              {/* Description / Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-700 font-medium">
                  Details / Notes <span className="text-rose-500">*</span>
                </Label>
                <textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Key discussion points, outcomes, next steps..."
                  rows={4}
                  required
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
                    "Save Activity"
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
