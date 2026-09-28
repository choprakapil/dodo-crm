import { Metadata } from "next";
import { SettingsNav } from "@/components/settings/settings-nav";
import { RoleWorkspace } from "@/components/settings/role-workspace";
import Link from "next/link";
import { Shield, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Roles & Permissions | Universal CRM",
  description: "Configure system and custom roles with fine-grained action scopes",
};

export default function RolesSettingsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <span>Roles & Permissions</span>
          <Link
            href="/app/help?article=roles-permissions"
            className="text-muted-foreground hover:text-primary transition"
            title="Roles & Permissions Help Guide"
          >
            <HelpCircle className="h-5 w-5" />
          </Link>
        </h1>
        <p className="text-muted-foreground text-sm">
          Define access levels, module actions, and data scopes (Own, Team, Company) for your team members.
        </p>
      </div>

      <SettingsNav />

      <RoleWorkspace />
    </div>
  );
}
