"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Missing or invalid reset token. Please check the link from your email.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to reset password.");
      }

      setIsSuccess(true);
      toast.success("Password reset successfully!", {
        description: "You can now sign in with your new password.",
      });

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Card className="border-slate-200/90 bg-white text-slate-900 shadow-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Invalid Reset Link</CardTitle>
          <CardDescription className="text-slate-500">
            No reset token was found in this link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-slate-600">
            Please make sure you clicked the full URL provided in the password reset email.
          </p>
          <Link href="/forgot-password">
            <Button variant="outline" className="w-full border-slate-300 hover:bg-slate-50 text-slate-700">
              Request New Reset Link
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200/90 bg-white text-slate-900 shadow-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Set New Password</CardTitle>
        <CardDescription className="text-slate-500">
          Enter a new secure password for your account
        </CardDescription>
      </CardHeader>

      {isSuccess ? (
        <CardContent className="space-y-4 pt-2">
          <div className="flex items-start space-x-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">Password Updated</p>
              <p className="mt-1 text-slate-700">
                Your password has been changed. Redirecting you to sign in...
              </p>
            </div>
          </div>
          <Link href="/login">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white mt-2">
              Go to Sign In
            </Button>
          </Link>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-start space-x-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 text-xs font-semibold">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-600 text-xs h-9"
              />
              <p className="text-[11px] text-slate-500">
                Minimum 8 characters with uppercase, lowercase, number, and symbol.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-700 text-xs font-semibold">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-600 text-xs h-9"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 shadow-xs transition-all text-xs h-9"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-slate-100 pt-4">
            <Link
              href="/login"
              className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Cancel and Return to Sign In
            </Link>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
