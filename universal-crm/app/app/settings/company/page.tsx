import { Metadata } from "next";
import { SettingsNav } from "@/components/settings/settings-nav";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import Link from "next/link";
import { Building2, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Company Settings | Universal CRM",
  description: "Manage organization details, profile, branding, and localization standards",
};

export default function CompanySettingsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <span>Company Settings</span>
          <Link
            href="/app/help?article=company-settings"
            className="text-muted-foreground hover:text-primary transition"
            title="Company Settings Help Guide"
          >
            <HelpCircle className="h-5 w-5" />
          </Link>
        </h1>
        <p className="text-muted-foreground text-sm">
          Update organization profile, support contact info, timezone, and business standards.
        </p>
      </div>

      <SettingsNav />

      <CompanySettingsForm />
    </div>
  );
}
