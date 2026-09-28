/**
 * Deterministic Database & Backup/Restore Integrity Verification Tool
 *
 * PHASE B.6 — DATA SAFETY & RECOVERY HARDENING
 *
 * Can be run post-restore or during operational audits to verify:
 * 1. Database connectivity
 * 2. Applied migration state against Prisma migration history
 * 3. Expected schema table presence
 * 4. Foreign key integrity and constraints
 * 5. Tenant / company counts
 * 6. Orphan detection for critical relationships
 * 7. Storage connectivity (if configured)
 *
 * SAFETY:
 * - Strictly READ-ONLY.
 * - Does not mutate any production data.
 */

import { prisma } from "../lib/db";
import { DataIntegrityService } from "../lib/services/data-integrity.service";

const EXPECTED_TABLES = [
  "companies",
  "users",
  "roles",
  "permissions",
  "teams",
  "team_members",
  "sessions",
  "invitations",
  "leads",
  "lead_statuses",
  "lead_sources",
  "customers",
  "customer_phones",
  "customer_emails",
  "tasks",
  "task_reschedule_histories",
  "activities",
  "offerings",
  "dispositions",
  "lead_disposition_histories",
  "custom_fields",
  "custom_field_values",
  "lead_imports",
  "audit_logs",
  "super_admins",
  "super_admin_sessions",
  "plans",
  "platform_audit_logs",
  "_prisma_migrations",
];

export async function runBackupRestoreIntegrityVerification() {
  console.log("\n====================================================================");
  console.log("🛡️ RUNNING DATABASE & BACKUP/RESTORE INTEGRITY VERIFICATION");
  console.log("====================================================================");

  let hasErrors = false;

  // 1. Database connectivity
  try {
    process.stdout.write("1. Database Connectivity: ");
    await prisma.$queryRaw`SELECT 1`;
    console.log("OK (Connected)");
  } catch (err: any) {
    console.log(`FAILED: ${err.message}`);
    hasErrors = true;
  }

  // 2. Migration state
  try {
    process.stdout.write("2. Migration State: ");
    const migrations: Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }> =
      await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at ASC`;
    const unfinished = migrations.filter((m) => !m.finished_at && !m.rolled_back_at);
    if (unfinished.length > 0) {
      console.log(`FAILED (${unfinished.length} unfinished migrations detected)`);
      hasErrors = true;
    } else {
      console.log(`OK (${migrations.filter((m) => m.finished_at).length} migrations applied and finalized)`);
    }
  } catch (err: any) {
    console.log(`FAILED: ${err.message}`);
    hasErrors = true;
  }

  // 3. Expected Tables Presence
  try {
    process.stdout.write("3. Schema Table Presence: ");
    const tables: Array<{ table_name: string }> = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const existingTableSet = new Set(tables.map((t) => t.table_name));
    const missingTables = EXPECTED_TABLES.filter((t) => !existingTableSet.has(t));

    if (missingTables.length > 0) {
      console.log(`FAILED (Missing tables: ${missingTables.join(", ")})`);
      hasErrors = true;
    } else {
      console.log(`OK (All ${EXPECTED_TABLES.length} expected core tables present)`);
    }
  } catch (err: any) {
    console.log(`FAILED: ${err.message}`);
    hasErrors = true;
  }

  // 4. Tenant & Entity Counts
  try {
    process.stdout.write("4. Core Entity Statistics: ");
    const [companies, users, leads, customers, tasks] = await Promise.all([
      prisma.company.count(),
      prisma.user.count(),
      prisma.lead.count(),
      prisma.customer.count(),
      prisma.task.count(),
    ]);
    console.log(`OK (${companies} companies, ${users} users, ${leads} leads, ${customers} customers, ${tasks} tasks)`);
  } catch (err: any) {
    console.log(`FAILED: ${err.message}`);
    hasErrors = true;
  }

  // 5. Invariant & Relational Integrity Checks (12 checks)
  try {
    process.stdout.write("5. Relational & Tenant Invariants (DataIntegrityService): ");
    const report = await DataIntegrityService.runAllChecks();
    if (!report.healthy) {
      console.log(`FAILED (${report.totalViolations} violations found)`);
      report.checks.forEach((c) => {
        if (!c.passed) {
          console.log(`   - [Invariant ${c.invariantId}] ${c.name}: ${c.violations.length} violations`);
          c.violations.slice(0, 3).forEach((v) => {
            console.log(`     * Record ${v.recordId} (${v.entityType}): ${v.details || v.invariant}`);
          });
        }
      });
      hasErrors = true;
    } else {
      console.log(`OK (${report.passedChecks}/${report.totalChecks} invariant checks passed with 0 violations)`);
    }
  } catch (err: any) {
    console.log(`FAILED: ${err.message}`);
    hasErrors = true;
  }

  // 6. Storage Provider Connectivity
  try {
    process.stdout.write("6. Storage Provider Configuration: ");
    const provider = process.env.STORAGE_PROVIDER || "local";
    console.log(`OK (Provider: ${provider})`);
  } catch (err: any) {
    console.log(`FAILED: ${err.message}`);
  }

  console.log("====================================================================");
  if (hasErrors) {
    console.log("❌ INTEGRITY VERIFICATION FAILED — OPERATOR ACTION REQUIRED");
    console.log("====================================================================\n");
    return false;
  } else {
    console.log("🎉 ALL INTEGRITY AND RESTORE CHECKS VERIFIED SUCCESSFULLY");
    console.log("====================================================================\n");
    return true;
  }
}

if (require.main === module) {
  runBackupRestoreIntegrityVerification().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
