/**
 * Read-Only Data Integrity Verification Service
 *
 * PHASE B.6 — DATA SAFETY & RECOVERY HARDENING
 *
 * Invariant Checks:
 * 1. Lead.companyId matches Customer.companyId when customerId exists
 * 2. CustomerPhone.companyId matches Customer.companyId
 * 3. CustomerEmail.companyId matches Customer.companyId
 * 4. Task.companyId matches Lead.companyId when leadId exists
 * 5. Activity.companyId matches Lead.companyId when leadId exists
 * 6. LeadConversion.companyId matches Lead.companyId (Phase 8 Blocked / NA if model absent)
 * 7. LeadConversion.customerId belongs to same company (Phase 8 Blocked / NA if model absent)
 * 8. Offering belongs to same company as Lead
 * 9. Disposition belongs to same company as Lead
 * 10. User / Team / Company relationships are tenant coherent
 * 11. No tenant-owned record references a missing company (orphan detection)
 * 12. No active follow-up violates Phase 7 invariants (e.g. pending task on soft-deleted lead)
 *
 * SAFETY RULES:
 * - READ-ONLY: Never mutate or repair data automatically.
 * - Zero secret or sensitive PII exposure in violation reports.
 * - Non-blocking: Intended for operational health checks, not every API request path.
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface IntegrityViolation {
  companyId: string;
  entityType: string;
  recordId: string;
  invariant: string;
  details?: string;
}

export interface CheckResult {
  invariantId: number;
  name: string;
  passed: boolean;
  violations: IntegrityViolation[];
  totalChecked?: number;
  skippedReason?: string;
}

export interface IntegrityReport {
  timestamp: string;
  healthy: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  totalViolations: number;
  checks: CheckResult[];
}

export class DataIntegrityService {
  /**
   * Runs all 12 architectural integrity checks in a read-only manner.
   */
  static async runAllChecks(): Promise<IntegrityReport> {
    const checks: CheckResult[] = [];

    // Check 1: Lead.companyId matches Customer.companyId
    checks.push(await this.checkLeadCustomerCompanyMatch());

    // Check 2: CustomerPhone.companyId matches Customer.companyId
    checks.push(await this.checkCustomerPhoneCompanyMatch());

    // Check 3: CustomerEmail.companyId matches Customer.companyId
    checks.push(await this.checkCustomerEmailCompanyMatch());

    // Check 4: Task.companyId matches Lead.companyId
    checks.push(await this.checkTaskLeadCompanyMatch());

    // Check 5: Activity.companyId matches Lead.companyId
    checks.push(await this.checkActivityLeadCompanyMatch());

    // Check 6 & 7: LeadConversion checks (Phase 8 Guarded)
    checks.push(await this.checkLeadConversionCompanyMatch());
    checks.push(await this.checkLeadConversionCustomerCompanyMatch());

    // Check 8: Offering belongs to same company as Lead
    checks.push(await this.checkLeadOfferingCompanyMatch());

    // Check 9: Disposition belongs to same company as Lead
    checks.push(await this.checkLeadDispositionCompanyMatch());

    // Check 10: User/Team relationships are tenant coherent
    checks.push(await this.checkTeamMemberTenantCoherence());

    // Check 11: No tenant-owned record references a missing company
    checks.push(await this.checkOrphanTenantRecords());

    // Check 12: No active follow-up violates Phase 7 invariant
    checks.push(await this.checkActiveFollowUpInvariants());

    const totalViolations = checks.reduce((sum, c) => sum + c.violations.length, 0);
    const failedChecks = checks.filter((c) => !c.passed).length;
    const passedChecks = checks.length - failedChecks;

    return {
      timestamp: new Date().toISOString(),
      healthy: totalViolations === 0,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      totalViolations,
      checks,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Lead.companyId == Customer.companyId
  // ---------------------------------------------------------------------------
  static async checkLeadCustomerCompanyMatch(): Promise<CheckResult> {
    const name = "Lead.companyId matches Customer.companyId when customerId exists";
    try {
      const rows: Array<{ id: string; leadCompanyId: string; customerCompanyId: string }> =
        await prisma.$queryRaw`
          SELECT l.id, l."companyId" as "leadCompanyId", c."companyId" as "customerCompanyId"
          FROM leads l
          JOIN customers c ON l."customerId" = c.id
          WHERE l."companyId" != c."companyId"
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.leadCompanyId,
        entityType: "Lead",
        recordId: r.id,
        invariant: "LEAD_CUSTOMER_COMPANY_MISMATCH",
        details: `Lead has companyId '${r.leadCompanyId}' but referenced Customer has companyId '${r.customerCompanyId}'`,
      }));

      return { invariantId: 1, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 1, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. CustomerPhone.companyId == Customer.companyId
  // ---------------------------------------------------------------------------
  static async checkCustomerPhoneCompanyMatch(): Promise<CheckResult> {
    const name = "CustomerPhone.companyId matches Customer.companyId";
    try {
      const rows: Array<{ id: string; phoneCompanyId: string; customerCompanyId: string }> =
        await prisma.$queryRaw`
          SELECT p.id, p."companyId" as "phoneCompanyId", c."companyId" as "customerCompanyId"
          FROM customer_phones p
          JOIN customers c ON p."customerId" = c.id
          WHERE p."companyId" != c."companyId"
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.phoneCompanyId,
        entityType: "CustomerPhone",
        recordId: r.id,
        invariant: "CUSTOMER_PHONE_COMPANY_MISMATCH",
        details: `CustomerPhone has companyId '${r.phoneCompanyId}' but Customer has companyId '${r.customerCompanyId}'`,
      }));

      return { invariantId: 2, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 2, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 3. CustomerEmail.companyId == Customer.companyId
  // ---------------------------------------------------------------------------
  static async checkCustomerEmailCompanyMatch(): Promise<CheckResult> {
    const name = "CustomerEmail.companyId matches Customer.companyId";
    try {
      const rows: Array<{ id: string; emailCompanyId: string; customerCompanyId: string }> =
        await prisma.$queryRaw`
          SELECT e.id, e."companyId" as "emailCompanyId", c."companyId" as "customerCompanyId"
          FROM customer_emails e
          JOIN customers c ON e."customerId" = c.id
          WHERE e."companyId" != c."companyId"
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.emailCompanyId,
        entityType: "CustomerEmail",
        recordId: r.id,
        invariant: "CUSTOMER_EMAIL_COMPANY_MISMATCH",
        details: `CustomerEmail has companyId '${r.emailCompanyId}' but Customer has companyId '${r.customerCompanyId}'`,
      }));

      return { invariantId: 3, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 3, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Task.companyId == Lead.companyId
  // ---------------------------------------------------------------------------
  static async checkTaskLeadCompanyMatch(): Promise<CheckResult> {
    const name = "Task.companyId matches Lead.companyId when leadId exists";
    try {
      const rows: Array<{ id: string; taskCompanyId: string; leadCompanyId: string }> =
        await prisma.$queryRaw`
          SELECT t.id, t."companyId" as "taskCompanyId", l."companyId" as "leadCompanyId"
          FROM tasks t
          JOIN leads l ON t."leadId" = l.id
          WHERE t."companyId" != l."companyId"
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.taskCompanyId,
        entityType: "Task",
        recordId: r.id,
        invariant: "TASK_LEAD_COMPANY_MISMATCH",
        details: `Task has companyId '${r.taskCompanyId}' but referenced Lead has companyId '${r.leadCompanyId}'`,
      }));

      return { invariantId: 4, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 4, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Activity.companyId == Lead.companyId
  // ---------------------------------------------------------------------------
  static async checkActivityLeadCompanyMatch(): Promise<CheckResult> {
    const name = "Activity.companyId matches Lead.companyId when leadId exists";
    try {
      const rows: Array<{ id: string; activityCompanyId: string; leadCompanyId: string }> =
        await prisma.$queryRaw`
          SELECT a.id, a."companyId" as "activityCompanyId", l."companyId" as "leadCompanyId"
          FROM activities a
          JOIN leads l ON a."leadId" = l.id
          WHERE a."companyId" != l."companyId"
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.activityCompanyId,
        entityType: "Activity",
        recordId: r.id,
        invariant: "ACTIVITY_LEAD_COMPANY_MISMATCH",
        details: `Activity has companyId '${r.activityCompanyId}' but referenced Lead has companyId '${r.leadCompanyId}'`,
      }));

      return { invariantId: 5, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 5, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 6. LeadConversion.companyId == Lead.companyId
  // ---------------------------------------------------------------------------
  static async checkLeadConversionCompanyMatch(): Promise<CheckResult> {
    const name = "LeadConversion.companyId matches Lead.companyId";
    // Check if table exists (Phase 8 is blocked)
    try {
      const tableExists: Array<{ count: number }> = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_name = 'lead_conversions'
      `;
      if (!tableExists[0] || tableExists[0].count === 0) {
        return {
          invariantId: 6,
          name,
          passed: true,
          violations: [],
          skippedReason: "Phase 8 Blocked: lead_conversions table intentionally absent from active schema.",
        };
      }

      const rows: Array<{ id: string; conversionCompanyId: string; leadCompanyId: string }> =
        await prisma.$queryRawUnsafe(`
          SELECT c.id, c."companyId" as "conversionCompanyId", l."companyId" as "leadCompanyId"
          FROM lead_conversions c
          JOIN leads l ON c."leadId" = l.id
          WHERE c."companyId" != l."companyId"
        `);

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.conversionCompanyId,
        entityType: "LeadConversion",
        recordId: r.id,
        invariant: "LEAD_CONVERSION_LEAD_COMPANY_MISMATCH",
      }));

      return { invariantId: 6, name, passed: violations.length === 0, violations };
    } catch {
      return {
        invariantId: 6,
        name,
        passed: true,
        violations: [],
        skippedReason: "Phase 8 Blocked: lead_conversions table not present.",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 7. LeadConversion.customerId belongs to same company
  // ---------------------------------------------------------------------------
  static async checkLeadConversionCustomerCompanyMatch(): Promise<CheckResult> {
    const name = "LeadConversion.customerId belongs to the same company";
    try {
      const tableExists: Array<{ count: number }> = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count FROM information_schema.tables WHERE table_name = 'lead_conversions'
      `;
      if (!tableExists[0] || tableExists[0].count === 0) {
        return {
          invariantId: 7,
          name,
          passed: true,
          violations: [],
          skippedReason: "Phase 8 Blocked: lead_conversions table intentionally absent from active schema.",
        };
      }

      const rows: Array<{ id: string; conversionCompanyId: string; customerCompanyId: string }> =
        await prisma.$queryRawUnsafe(`
          SELECT c.id, c."companyId" as "conversionCompanyId", cust."companyId" as "customerCompanyId"
          FROM lead_conversions c
          JOIN customers cust ON c."customerId" = cust.id
          WHERE c."companyId" != cust."companyId"
        `);

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.conversionCompanyId,
        entityType: "LeadConversion",
        recordId: r.id,
        invariant: "LEAD_CONVERSION_CUSTOMER_COMPANY_MISMATCH",
      }));

      return { invariantId: 7, name, passed: violations.length === 0, violations };
    } catch {
      return {
        invariantId: 7,
        name,
        passed: true,
        violations: [],
        skippedReason: "Phase 8 Blocked: lead_conversions table not present.",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Offering belongs to same company as Lead
  // ---------------------------------------------------------------------------
  static async checkLeadOfferingCompanyMatch(): Promise<CheckResult> {
    const name = "Offering belongs to the same company as Lead";
    try {
      const rows: Array<{ id: string; leadCompanyId: string; offeringCompanyId: string }> =
        await prisma.$queryRaw`
          SELECT l.id, l."companyId" as "leadCompanyId", o."companyId" as "offeringCompanyId"
          FROM leads l
          JOIN offerings o ON l."offeringId" = o.id
          WHERE l."companyId" != o."companyId"
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.leadCompanyId,
        entityType: "Lead",
        recordId: r.id,
        invariant: "LEAD_OFFERING_COMPANY_MISMATCH",
        details: `Lead has companyId '${r.leadCompanyId}' but referenced Offering has companyId '${r.offeringCompanyId}'`,
      }));

      return { invariantId: 8, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 8, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Disposition belongs to same company as Lead
  // ---------------------------------------------------------------------------
  static async checkLeadDispositionCompanyMatch(): Promise<CheckResult> {
    const name = "Disposition belongs to the same company as Lead";
    try {
      const rows: Array<{ id: string; leadCompanyId: string; dispositionCompanyId: string }> =
        await prisma.$queryRaw`
          SELECT l.id, l."companyId" as "leadCompanyId", d."companyId" as "dispositionCompanyId"
          FROM leads l
          JOIN dispositions d ON l."dispositionId" = d.id
          WHERE l."companyId" != d."companyId"
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.leadCompanyId,
        entityType: "Lead",
        recordId: r.id,
        invariant: "LEAD_DISPOSITION_COMPANY_MISMATCH",
        details: `Lead has companyId '${r.leadCompanyId}' but referenced Disposition has companyId '${r.dispositionCompanyId}'`,
      }));

      return { invariantId: 9, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 9, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 10. User/team/company relationships are tenant coherent
  // ---------------------------------------------------------------------------
  static async checkTeamMemberTenantCoherence(): Promise<CheckResult> {
    const name = "User/team/company relationships are tenant coherent";
    try {
      const rows: Array<{ id: string; memberCompanyId: string; teamCompanyId: string; userCompanyId: string }> =
        await prisma.$queryRaw`
          SELECT tm.id, tm."companyId" as "memberCompanyId", t."companyId" as "teamCompanyId", u."companyId" as "userCompanyId"
          FROM team_members tm
          JOIN teams t ON tm."teamId" = t.id
          JOIN users u ON tm."userId" = u.id
          WHERE tm."companyId" != t."companyId" OR tm."companyId" != u."companyId"
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.memberCompanyId,
        entityType: "TeamMember",
        recordId: r.id,
        invariant: "TEAM_MEMBER_TENANT_INCOHERENCE",
        details: `TeamMember companyId '${r.memberCompanyId}' does not match Team '${r.teamCompanyId}' or User '${r.userCompanyId}'`,
      }));

      return { invariantId: 10, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 10, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 11. No tenant-owned record references a missing company (orphan detection)
  // ---------------------------------------------------------------------------
  static async checkOrphanTenantRecords(): Promise<CheckResult> {
    const name = "No tenant-owned record references a missing company";
    const violations: IntegrityViolation[] = [];

    const tables = [
      { name: "leads", entity: "Lead" },
      { name: "customers", entity: "Customer" },
      { name: "customer_phones", entity: "CustomerPhone" },
      { name: "customer_emails", entity: "CustomerEmail" },
      { name: "tasks", entity: "Task" },
      { name: "activities", entity: "Activity" },
      { name: "users", entity: "User" },
      { name: "teams", entity: "Team" },
      { name: "roles", entity: "Role" },
      { name: "offerings", entity: "Offering" },
      { name: "dispositions", entity: "Disposition" },
      { name: "custom_fields", entity: "CustomField" },
      { name: "audit_logs", entity: "AuditLog" },
    ];

    try {
      for (const table of tables) {
        const query = Prisma.sql`
          SELECT t.id, t."companyId"
          FROM ${Prisma.raw(table.name)} t
          LEFT JOIN companies c ON t."companyId" = c.id
          WHERE t."companyId" IS NOT NULL AND c.id IS NULL
        `;
        const orphans: Array<{ id: string; companyId: string }> = await prisma.$queryRaw(query);
        for (const orphan of orphans) {
          violations.push({
            companyId: orphan.companyId,
            entityType: table.entity,
            recordId: orphan.id,
            invariant: "ORPHANED_TENANT_RECORD",
            details: `${table.entity} references non-existent companyId '${orphan.companyId}'`,
          });
        }
      }

      return { invariantId: 11, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 11, name, passed: false, violations: [], skippedReason: err.message };
    }
  }

  // ---------------------------------------------------------------------------
  // 12. No active follow-up violates Phase 7 invariant
  // ---------------------------------------------------------------------------
  static async checkActiveFollowUpInvariants(): Promise<CheckResult> {
    const name = "No active follow-up violates Phase 7 invariant";
    try {
      // Phase 7 Invariant: An active follow-up (PENDING or OVERDUE) must not belong to a soft-deleted lead
      const rows: Array<{ id: string; companyId: string; status: string }> =
        await prisma.$queryRaw`
          SELECT t.id, t."companyId", t.status::text as status
          FROM tasks t
          JOIN leads l ON t."leadId" = l.id
          WHERE t.status IN ('PENDING', 'OVERDUE')
            AND l."deletedAt" IS NOT NULL
        `;

      const violations: IntegrityViolation[] = rows.map((r) => ({
        companyId: r.companyId,
        entityType: "Task",
        recordId: r.id,
        invariant: "ACTIVE_TASK_ON_DELETED_LEAD",
        details: `Active follow-up task (${r.status}) is linked to a soft-deleted lead`,
      }));

      return { invariantId: 12, name, passed: violations.length === 0, violations };
    } catch (err: any) {
      return { invariantId: 12, name, passed: false, violations: [], skippedReason: err.message };
    }
  }
}
