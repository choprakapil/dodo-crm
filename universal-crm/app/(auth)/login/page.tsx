"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, AlertCircle, ArrowRight, ShieldCheck, Check } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "Company Admin (Owner)",
    name: "Dheeraj Aggarwal",
    email: "info@thewebtycoons.com",
    password: "Demo@123456",
    badge: "Webtycoons",
  },
];

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/app";

  const [email, setEmail] = useState("info@thewebtycoons.com");
  const [password, setPassword] = useState("Demo@123456");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuickEmail, setActiveQuickEmail] = useState<string | null>("info@thewebtycoons.com");

  const performLogin = async (targetEmail: string, targetPass: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass, companySlug: "webtycoons" }),
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

  const handleQuickLogin = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setActiveQuickEmail(acc.email);
    await performLogin(acc.email, acc.password);
  };

  return (
    <div className="space-y-4">
      <Card className="border-slate-200/90 bg-white text-slate-900 shadow-md">
        <CardHeader className="space-y-1.5 pb-4 text-center">
          <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
            Welcome back
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Sign in to your Webtycoons workspace
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setActiveQuickEmail(null);
                }}
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

      {/* 1-Click Verified Demo Accounts Strip */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            Verified Demo Accounts
          </span>
          <span className="text-[10px] text-indigo-600 font-medium">1-Click Sign In</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {DEMO_ACCOUNTS.map((acc) => {
            const isActive = activeQuickEmail === acc.email;
            return (
              <button
                key={acc.email}
                type="button"
                disabled={isLoading}
                onClick={() => handleQuickLogin(acc)}
                className={`text-left p-2.5 rounded-lg border transition group relative ${
                  isActive
                    ? "border-indigo-500 bg-indigo-50/70 shadow-2xs"
                    : "border-slate-200 bg-slate-50/60 hover:border-indigo-200 hover:bg-indigo-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-[11px] font-semibold text-slate-900 truncate group-hover:text-indigo-700">
                    {acc.name}
                  </span>
                  {isActive && <Check className="h-3 w-3 text-indigo-600 shrink-0" />}
                </div>
                <div className="text-[10px] font-medium text-indigo-600 truncate">{acc.role}</div>
                <div className="text-[9px] text-slate-500 font-mono truncate mt-0.5">
                  {acc.email}
                </div>
              </button>
            );
          })}
        </div>
      </div>
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
