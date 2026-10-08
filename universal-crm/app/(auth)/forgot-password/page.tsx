"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to submit request.");
      }

      setSuccessMessage(
        data.message ||
          "If an account with that email exists, instructions have been sent to reset your password."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-slate-200/90 bg-white text-slate-900 shadow-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Reset Password</CardTitle>
        <CardDescription className="text-slate-500">
          Enter your email address and we will send you a password reset link
        </CardDescription>
      </CardHeader>

      {successMessage ? (
        <CardContent className="space-y-4 pt-2">
          <div className="flex items-start space-x-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">Request Received</p>
              <p className="mt-1 text-slate-700">{successMessage}</p>
            </div>
          </div>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="outline" className="w-full border-slate-300 hover:bg-slate-50 text-slate-700">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Sign In
              </Button>
            </Link>
          </div>
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
              <Label htmlFor="email" className="text-slate-700 text-xs font-semibold">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
                  Sending link...
                </>
              ) : (
                "Send Password Reset Link"
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex justify-center border-t border-slate-100 pt-4">
            <Link
              href="/login"
              className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back to Sign In
            </Link>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
