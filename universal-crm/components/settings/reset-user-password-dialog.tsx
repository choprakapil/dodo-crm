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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

interface ResetUserPasswordDialogProps {
  userId: string | null;
  userName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetUserPasswordDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: ResetUserPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to reset password");
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(null);
    setSuccess(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                Reset Password
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Set a temporary or new password for {userName}. This will immediately revoke all active sessions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {success ? (
          <div className="space-y-4 py-3">
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Password Reset Successfully</p>
                <p className="text-slate-600 mt-1">
                  The user can now log in using the new password. All prior sessions have been revoked.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={handleClose}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 shadow-sm"
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4 py-2">
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="admin-new-password" className="text-xs text-slate-700 font-medium">
                New Temporary Password <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="admin-new-password"
                type="password"
                placeholder="At least 8 characters (uppercase, lowercase, number, symbol)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !password}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 font-medium shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Confirm Reset"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
