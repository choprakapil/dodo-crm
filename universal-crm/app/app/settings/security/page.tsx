import { Metadata } from "next";
import { SettingsNav } from "@/components/settings/settings-nav";
import { SecurityWorkspace } from "@/components/settings/security-workspace";
import Link from "next/link";
import { ShieldCheck, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Security & Sessions | Universal CRM",
  description: "Manage credentials, password policies, and active sessions",
};

export default function SecuritySettingsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span>Security & Active Sessions</span>
          <Link
            href="/app/help?article=security"
            className="text-muted-foreground hover:text-primary transition"
            title="Security & Sessions Help Guide"
          >
            <HelpCircle className="h-5 w-5" />
          </Link>
        </h1>
        <p className="text-muted-foreground text-sm">
          Update account password and monitor or revoke active devices and browser sessions.
        </p>
      </div>

      <SettingsNav />

      <SecurityWorkspace />
    </div>
  );
}
