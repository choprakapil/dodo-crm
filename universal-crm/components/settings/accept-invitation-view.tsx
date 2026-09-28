"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, UserCheck, Lock, AlertCircle, Loader2, CheckCircle2, ArrowRight } from "lucide-react";

interface InvitationData {
  email: string;
  role: string;
  team?: string | null;
  company: string;
  expiresAt: string;
}

interface AcceptInvitationViewProps {
  token: string;
}

export function AcceptInvitationView({ token }: AcceptInvitationViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/v1/invitations/${token}`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || "Invalid or expired invitation token.");
        }
        setInvitation(json.data);
      } catch (err: any) {
        setError(err.message || "Failed to verify invitation.");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      verifyToken();
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSubmitError("Please enter your full name.");
      return;
    }
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const res = await fetch("/api/v1/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to accept invitation.");
      }

      setSuccess(true);
      setTimeout(() => {
        if (!json.data?.company?.onboardingCompleted && json.data?.user?.role === "Admin") {
          router.push("/app/onboarding");
        } else {
          router.push("/app/leads");
        }
      }, 1500);
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Universal CRM</h1>
          <p className="text-sm text-muted-foreground">Team Member Invitation</p>
        </div>

        <Card className="border shadow-lg">
          {loading ? (
            <CardContent className="flex flex-col items-center justify-center p-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying invitation link...</p>
            </CardContent>
          ) : error ? (
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Invitation Unavailable</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={() => router.push("/login")} className="mt-4">
                Back to Login
              </Button>
            </CardContent>
          ) : success ? (
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Welcome to the Team!</h2>
              <p className="text-sm text-muted-foreground">
                Your account is activated and you are being redirected to the CRM workspace...
              </p>
              <div className="flex justify-center pt-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-xl">Accept Your Invitation</CardTitle>
                <CardDescription>
                  You have been invited to join{" "}
                  <strong className="text-foreground font-semibold">{invitation?.company}</strong>.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Role & Team info badges */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2 border text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned Role:</span>
                    <Badge variant="outline" className="font-semibold">
                      {invitation?.role}
                    </Badge>
                  </div>
                  {invitation?.team && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned Team:</span>
                      <span className="font-medium text-foreground">{invitation.team}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-mono text-foreground">{invitation?.email}</span>
                  </div>
                </div>

                {submitError && (
                  <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Your Full Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Create Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-2 border-t pt-4">
                <Button type="submit" disabled={submitting} className="w-full gap-2">
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  Accept & Complete Setup
                </Button>
                <p className="text-[11px] text-center text-muted-foreground">
                  By accepting, you gain access to your team workspace under the company&apos;s data policies.
                </p>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
