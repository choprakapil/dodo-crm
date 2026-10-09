"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/app";
  const companyParam = searchParams.get("company") || undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performLogin = async (targetEmail: string, targetPass: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const payload: { email: string; password: string; companySlug?: string } = {
        email: targetEmail.trim(),
        password: targetPass,
      };
      if (companyParam) {
        payload.companySlug = companyParam;
      }

      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Invalid credentials. Please verify your email and password.");
      }

      toast.success("Welcome back!", {
        description: `Signed in as ${data.data.user.name} (${data.data.company.name})`,
      });

      // Full document redirect ensures HTTP-only session cookie is attached cleanly
      window.location.href = redirectUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
      toast.error("Sign in failed", { description: message });
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200/90 bg-white text-slate-900 shadow-md">
        <CardHeader className="space-y-1.5 pb-4 text-center">
          <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
            Welcome back
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Sign in to your CRM workspace
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3.5 pt-0">
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-700">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-9 border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-indigo-600 focus-visible:border-indigo-600"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-slate-700">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-9 border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-indigo-600 focus-visible:border-indigo-600 font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <span>Sign In to CRM</span>
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Tenant-isolated session
            </span>
            <span className="font-mono text-[10px] text-slate-400">v2.0 Client Edition</span>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
