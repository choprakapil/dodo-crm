"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  UserCheck,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Phone,
  User,
  Shield,
  Users,
} from "lucide-react";

interface InvitationCompany {
  id: string;
  name: string;
  slug: string;
  status: string;
}

interface InvitationData {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: string;
  team?: string | null;
  company: InvitationCompany | string;
  inviterName?: string;
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
  const [phone, setPhone] = useState("");
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
        if (json.data?.name) setName(json.data.name);
        if (json.data?.phone) setPhone(json.data.phone);
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
          phone: phone.trim() || undefined,
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

  const companyName =
    typeof invitation?.company === "object"
      ? invitation.company.name
      : invitation?.company || "DODO CRM Workspace";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC]">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-100 mb-1">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">DODO CRM</h1>
          <p className="text-xs text-slate-500">Team Member Profile &amp; Account Activation</p>
        </div>

        <Card className="border-slate-200 bg-white shadow-xl rounded-2xl overflow-hidden">
          {loading ? (
            <CardContent className="flex flex-col items-center justify-center p-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-xs text-slate-500 font-medium">Verifying your invitation link...</p>
            </CardContent>
          ) : error ? (
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-rose-50 text-rose-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Invitation Unavailable</h2>
              <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
              <Button
                variant="outline"
                onClick={() => router.push("/login")}
                className="mt-4 border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
              >
                Back to Login
              </Button>
            </CardContent>
          ) : success ? (
            <CardContent className="p-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center p-3 rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Welcome to the Team!</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Your profile has been created and your account is active. Redirecting to your CRM workspace...
              </p>
              <div className="flex justify-center pt-2">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
              </div>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader className="space-y-1 pb-4 border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-900">Join {companyName}</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {invitation?.inviterName || "Your administrator"} has invited you to join the team workspace. Complete your profile below to get started.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-4">
                {/* Role & Team info badge */}
                <div className="p-3 bg-slate-50/80 rounded-xl space-y-2 border border-slate-200/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-indigo-600" /> Assigned Role:
                    </span>
                    <Badge variant="outline" className="font-semibold bg-indigo-50 border-indigo-200 text-indigo-700 text-[11px]">
                      {invitation?.role}
                    </Badge>
                  </div>
                  {invitation?.team && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400" /> Assigned Team:
                      </span>
                      <span className="font-medium text-slate-800">{invitation.team}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Work Email:</span>
                    <span className="font-mono text-slate-800 font-medium">{invitation?.email}</span>
                  </div>
                </div>

                {submitError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
                    Your Full Name <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      required
                      className="pl-9 bg-white border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">
                    Phone / Mobile Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="pl-9 bg-white border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                    Create Password <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className="pl-9 bg-white border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">
                    Confirm Password <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      className="pl-9 bg-white border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-2 border-t border-slate-100 pt-4 bg-slate-50/50">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-9 shadow-xs"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserCheck className="h-4 w-4 mr-2" />
                  )}
                  Accept &amp; Complete Setup
                </Button>
                <p className="text-[11px] text-center text-slate-400">
                  By joining, you agree to your organization&apos;s data governance and access policies.
                </p>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

