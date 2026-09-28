"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

interface DeleteLeadDialogProps {
  leadId: string;
  leadName: string;
  onDeleted?: () => void;
  redirectAfterDelete?: boolean;
}

export function DeleteLeadDialog({
  leadId,
  leadName,
  onDeleted,
  redirectAfterDelete = false,
}: DeleteLeadDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to delete lead");
        setIsDeleting(false);
        return;
      }

      setIsOpen(false);
      if (redirectAfterDelete) {
        router.push("/app/leads");
      } else {
        onDeleted?.();
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
        title="Delete Lead"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-xl border border-rose-500/20 bg-slate-900 p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="h-9 w-9 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Delete Lead</h3>
                <p className="text-xs text-slate-400">This action can be undone by admins.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to soft-delete <span className="font-semibold text-white">&quot;{leadName}&quot;</span>?
              It will be hidden from normal listings.
            </p>

            {error && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
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
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                size="sm"
                className="bg-rose-600 hover:bg-rose-500 text-xs text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Deleting...
                  </>
                ) : (
                  "Confirm Delete"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
