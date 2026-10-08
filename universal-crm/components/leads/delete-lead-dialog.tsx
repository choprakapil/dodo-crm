"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteLeadDialogProps {
  leadId: string;
  leadName: string;
  redirectTo?: string;
}

export function DeleteLeadDialog({
  leadId,
  leadName,
  redirectTo = "/app/leads",
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

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to delete lead");
      }

      setIsOpen(false);
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
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
        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
        title="Delete Lead"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-xl border border-rose-200 bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-lg bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Delete Lead</h3>
                <p className="text-xs text-slate-500">This action can be undone by admins.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to soft-delete <span className="font-semibold text-slate-900">&quot;{leadName}&quot;</span>?
              It will be hidden from active CRM pipelines.
            </p>

            {error && (
              <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded border border-rose-200">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-xs text-white font-medium shadow-xs"
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
