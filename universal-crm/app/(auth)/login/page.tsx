"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Invalid credentials. Please try again.");
      }

      toast.success("Welcome back!", {
        description: `Signed in as ${data.data.user.email} (${data.data.company.name})`,
      });

      router.push(redirectUrl);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign in";
      setError(message);
      toast.error("Sign in failed", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (testEmail: string, testPass: string) => {
    setEmail(testEmail);
    setPassword(testPass);
    setError(null);
  };

  return (
    <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight text-white">Sign In</CardTitle>
        <CardDescription className="text-slate-400">
          Enter your company credentials to access your CRM workspace
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-start space-x-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-300">
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
              className="border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
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
              className="border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 shadow-lg shadow-indigo-600/25 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In to Workspace"
            )}
          </Button>

          {/* Quick Demo Credentials for Reviewers */}
          <div className="mt-6 border-t border-slate-800/80 pt-4">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Demo Test Accounts
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickFill("admin@acmecorp.com", "Admin@Acme123!")}
                className="rounded-md border border-slate-800 bg-slate-800/40 p-2 text-left hover:border-indigo-500/50 hover:bg-slate-800/80 transition"
              >
                <div className="font-semibold text-slate-200">Acme Admin</div>
                <div className="text-slate-400 truncate">admin@acmecorp.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("sarah@acmecorp.com", "SalesRep@Acme123!")}
                className="rounded-md border border-slate-800 bg-slate-800/40 p-2 text-left hover:border-indigo-500/50 hover:bg-slate-800/80 transition"
              >
                <div className="font-semibold text-slate-200">Acme Sales Rep</div>
                <div className="text-slate-400 truncate">sarah@acmecorp.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("admin@zenithsolutions.com", "Admin@Zenith123!")}
                className="rounded-md border border-slate-800 bg-slate-800/40 p-2 text-left hover:border-indigo-500/50 hover:bg-slate-800/80 transition"
              >
                <div className="font-semibold text-slate-200">Zenith Admin</div>
                <div className="text-slate-400 truncate">admin@zenith...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill("jennifer@zenithsolutions.com", "SalesRep@Zenith123!")}
                className="rounded-md border border-slate-800 bg-slate-800/40 p-2 text-left hover:border-indigo-500/50 hover:bg-slate-800/80 transition"
              >
                <div className="font-semibold text-slate-200">Zenith Rep</div>
                <div className="text-slate-400 truncate">jennifer@zenith...</div>
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-slate-800/60 pt-4 text-xs text-slate-400">
          Protected by tenant isolation & encrypted session cookies.
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
