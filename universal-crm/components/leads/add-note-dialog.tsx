"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addNoteToLead } from "@/lib/actions/note-actions";

interface AddNoteDialogProps {
  leadId: string;
  leadName: string;
}

export function AddNoteDialog({ leadId, leadName }: AddNoteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || trimmed.length < 2) {
      toast.error("Note content must be at least 2 characters long");
      return;
    }

    setSubmitting(true);
    try {
      const res = await addNoteToLead(leadId, trimmed);
      if (res.success) {
        toast.success("Note added to sales record");
        setContent("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to add note");
      }
    } catch {
      toast.error("Network error while adding note");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs shadow-2xs"
        title="Add Sales Note"
      >
        <FileText className="h-3.5 w-3.5 mr-1 text-indigo-600" />
        <span>Add Note</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <FileText className="h-4 w-4" />
              </div>
              <span>Add Note — {leadName}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Note Content <span className="text-rose-500">*</span>
              </Label>
              <textarea
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Record customer preferences, budget discussions, follow-up instructions, or internal remarks..."
                className="w-full mt-1.5 p-3 rounded-md bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none shadow-2xs"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || content.trim().length < 2}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  "Save Note"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
