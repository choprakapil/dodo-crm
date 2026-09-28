"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface UserStatusDialogProps {
  userId: string | null;
  userName: string | null;
  targetStatus: "ACTIVE" | "DISABLED" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChanged?: () => void;
}

export function UserStatusDialog({
  userId,
  userName,
  targetStatus,
  open,
  onOpenChange,
  onStatusChanged,
}: UserStatusDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabling = targetStatus === "DISABLED";

  const handleConfirm = async () => {
    if (!userId || !targetStatus) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/users/${userId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update user status");
      }

      onOpenChange(false);
      if (onStatusChanged) {
        onStatusChanged();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div
              className={`p-2 rounded-lg border ${
                isDisabling
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              }`}
            >
              {isDisabling ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-100">
                {isDisabling ? "Disable User Account" : "Activate User Account"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                {isDisabling
                  ? `Are you sure you want to disable ${userName}'s account?`
                  : `Are you sure you want to reactivate ${userName}'s account?`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {isDisabling ? (
            <p className="text-xs text-slate-300 leading-relaxed">
              Disabling this account will <strong className="text-rose-400">immediately invalidate all active sessions</strong>. The user will be blocked from logging in or making any API calls until re-enabled by an administrator.
            </p>
          ) : (
            <p className="text-xs text-slate-300 leading-relaxed">
              Reactivating this account will restore the user&apos;s ability to sign in and perform actions based on their assigned role permissions.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`text-xs h-9 font-medium text-white ${
              isDisabling
                ? "bg-rose-600 hover:bg-rose-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Processing...
              </>
            ) : isDisabling ? (
              "Disable Account"
            ) : (
              "Activate Account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
