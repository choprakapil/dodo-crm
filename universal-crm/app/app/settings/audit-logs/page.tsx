import { Metadata } from "next";
import { SettingsNav } from "@/components/settings/settings-nav";
import { AuditLogWorkspace } from "@/components/settings/audit-log-workspace";
import Link from "next/link";
import { FileText, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Audit Logs | Universal CRM",
  description: "Immutable, tenant-isolated audit trail of system activities and changes",
};

export default function AuditLogsSettingsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <span>Audit Logs</span>
          <Link
            href="/app/help?article=audit-logs"
            className="text-muted-foreground hover:text-primary transition"
            title="Audit Logs Help Guide"
          >
            <HelpCircle className="h-5 w-5" />
          </Link>
        </h1>
        <p className="text-muted-foreground text-sm">
          Examine tamper-proof audit trails for administrative actions, entity modifications, and security events.
        </p>
      </div>

      <SettingsNav />

      <AuditLogWorkspace />
    </div>
  );
}
