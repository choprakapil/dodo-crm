/**
 * PHASE 8: Status Classification & Default Status Conflict Dry-Run Runner
 * 
 * STRICT INVARIANT: 100% READ ONLY.
 * ZERO DATABASE MUTATIONS (No INSERT, UPDATE, DELETE, ALTER, or DROP).
 * 
 * Objectives:
 * 1. Inspect all existing LeadStatus records across every tenant company.
 * 2. Classify statuses deterministically into proposed categories (OPEN, WON, LOST, or AMBIGUOUS).
 * 3. Inspect existing default status configuration per company and per category.
 * 4. Detect conflicts that would block the partial unique index:
 *    - Multiple default OPEN statuses
 *    - Multiple default WON statuses
 *    - Multiple default LOST statuses
 *    - Inactive default statuses
 * 5. Report lead distribution across proposed lifecycle states.
 * 6. Output an authoritative migration readiness verdict.
 */

import { prisma } from "../lib/db";

export type ProposedCategory = "OPEN" | "WON" | "LOST" | "AMBIGUOUS";

export interface StatusAuditItem {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  isActive: boolean; // defaults to true in current schema
  displayOrder: number;
  leadCount: number;
  proposedCategory: ProposedCategory;
  classificationConfidence: "HIGH" | "MEDIUM" | "AMBIGUOUS";
  rationale: string;
}

export interface DefaultCategoryAudit {
  category: "OPEN" | "WON" | "LOST" | "AMBIGUOUS";
  defaultCount: number;
  defaultStatusIds: string[];
  defaultStatusNames: string[];
  hasConflict: boolean;
  hasInactiveDefault: boolean;
  recommendedResolution: string;
}

export interface CompanyAuditReport {
  companyId: string;
  companyName: string;
  totalStatuses: number;
  totalLeads: number;
  statuses: StatusAuditItem[];
  defaultCategoryAudits: Record<string, DefaultCategoryAudit>;
  hasAnyConflict: boolean;
  summary: {
    openStatusesCount: number;
    wonStatusesCount: number;
    lostStatusesCount: number;
    ambiguousStatusesCount: number;
    leadsInOpen: number;
    leadsInWon: number;
    leadsInLost: number;
    leadsInAmbiguous: number;
  };
}

export interface DryRunGlobalReport {
  timestamp: string;
  companiesAudited: number;
  totalStatuses: number;
  totalLeads: number;
  globalConflictsCount: number;
  companiesWithConflicts: string[];
  companyReports: CompanyAuditReport[];
  statusClassificationCatalog: {
    statusName: string;
    proposedCategory: ProposedCategory;
    totalOccurrences: number;
    totalLeads: number;
  }[];
  migrationReadinessVerdict: "READY" | "BLOCKED_BY_CONFLICTS";
  readOnlyVerification: boolean;
}

/**
 * Deterministic status classification logic based on business taxonomy.
 */
export function classifyStatus(name: string): {
  category: ProposedCategory;
  confidence: "HIGH" | "MEDIUM" | "AMBIGUOUS";
  rationale: string;
} {
  const normalized = name.trim().toLowerCase();

  // 1. Explicit WON patterns
  const wonExact = ["converted", "won", "closed won", "deal won", "successful", "completed"];
  if (wonExact.includes(normalized)) {
    return {
      category: "WON",
      confidence: "HIGH",
      rationale: `Exact match for authoritative WON business status "${name}"`,
    };
  }
  if (normalized.includes("won") || normalized.includes("converted")) {
    return {
      category: "WON",
      confidence: "HIGH",
      rationale: `Keyword match for WON status "${name}"`,
    };
  }

  // 2. Explicit LOST patterns
  const lostExact = [
    "lost",
    "closed lost",
    "rejected",
    "disqualified",
    "dropped",
    "cancelled",
    "canceled",
    "not interested",
    "abandoned",
    "dead lead",
  ];
  if (lostExact.includes(normalized)) {
    return {
      category: "LOST",
      confidence: "HIGH",
      rationale: `Exact match for authoritative LOST business status "${name}"`,
    };
  }
  if (normalized.includes("lost") || normalized.includes("reject") || normalized.includes("disqualif")) {
    return {
      category: "LOST",
      confidence: "HIGH",
      rationale: `Keyword match for LOST status "${name}"`,
    };
  }

  // 3. Ambiguous patterns (Must NOT silently auto-close)
  const ambiguousPatterns = ["closed", "archive", "archived", "ended", "inactive", "done"];
  if (ambiguousPatterns.includes(normalized)) {
    return {
      category: "AMBIGUOUS",
      confidence: "AMBIGUOUS",
      rationale: `Ambiguous term "${name}" could mean Won or Lost. Safe default is OPEN pending explicit operator decision.`,
    };
  }

  // 4. Default OPEN patterns (All active pipeline stages)
  return {
    category: "OPEN",
    confidence: "HIGH",
    rationale: `Active pipeline enquiry stage "${name}"`,
  };
}

/**
 * Main Dry-Run Execution Function (100% Read-Only)
 */
export async function runStatusClassificationDryRun(): Promise<DryRunGlobalReport> {
  // 1. Fetch all companies
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const companyReports: CompanyAuditReport[] = [];
  let totalStatusesCount = 0;
  let totalLeadsCount = 0;
  let globalConflictsCount = 0;
  const companiesWithConflicts: string[] = [];

  // Aggregator for global catalog
  const catalogMap = new Map<
    string,
    { statusName: string; proposedCategory: ProposedCategory; totalOccurrences: number; totalLeads: number }
  >();

  for (const company of companies) {
    // 2. Fetch all statuses for company with their lead counts
    const statuses = await prisma.leadStatus.findMany({
      where: { companyId: company.id },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: {
          select: { leads: { where: { deletedAt: null } } },
        },
      },
    });

    totalStatusesCount += statuses.length;

    const statusAuditItems: StatusAuditItem[] = [];
    const categoryDefaultsMap: Record<
      string,
      { ids: string[]; names: string[]; inactiveCount: number }
    > = {
      OPEN: { ids: [], names: [], inactiveCount: 0 },
      WON: { ids: [], names: [], inactiveCount: 0 },
      LOST: { ids: [], names: [], inactiveCount: 0 },
      AMBIGUOUS: { ids: [], names: [], inactiveCount: 0 },
    };

    let companyLeads = 0;
    let openLeads = 0;
    let wonLeads = 0;
    let lostLeads = 0;
    let ambiguousLeads = 0;

    let openCount = 0;
    let wonCount = 0;
    let lostCount = 0;
    let ambiguousCount = 0;

    for (const status of statuses) {
      const leadCount = status._count.leads;
      companyLeads += leadCount;

      const classification = classifyStatus(status.name);
      const isActive = (status as unknown as { isActive?: boolean }).isActive ?? true;

      const item: StatusAuditItem = {
        id: status.id,
        name: status.name,
        color: status.color,
        isDefault: status.isDefault,
        isActive,
        displayOrder: status.displayOrder,
        leadCount,
        proposedCategory: classification.category,
        classificationConfidence: classification.confidence,
        rationale: classification.rationale,
      };

      statusAuditItems.push(item);

      // Track lead counts by category
      if (classification.category === "OPEN") {
        openLeads += leadCount;
        openCount++;
      } else if (classification.category === "WON") {
        wonLeads += leadCount;
        wonCount++;
      } else if (classification.category === "LOST") {
        lostLeads += leadCount;
        lostCount++;
      } else {
        ambiguousLeads += leadCount;
        ambiguousCount++;
      }

      // Track defaults per proposed category
      if (status.isDefault) {
        const catTarget = categoryDefaultsMap[classification.category];
        if (catTarget) {
          catTarget.ids.push(status.id);
          catTarget.names.push(status.name);
          if (!isActive) {
            catTarget.inactiveCount++;
          }
        }
      }

      // Update global catalog
      const catalogKey = status.name.trim().toLowerCase();
      const existingCatalog = catalogMap.get(catalogKey);
      if (existingCatalog) {
        existingCatalog.totalOccurrences++;
        existingCatalog.totalLeads += leadCount;
      } else {
        catalogMap.set(catalogKey, {
          statusName: status.name,
          proposedCategory: classification.category,
          totalOccurrences: 1,
          totalLeads: leadCount,
        });
      }
    }

    totalLeadsCount += companyLeads;

    // 3. Inspect default conflicts per category
    const defaultCategoryAudits: Record<string, DefaultCategoryAudit> = {};
    let companyHasConflict = false;

    for (const cat of ["OPEN", "WON", "LOST", "AMBIGUOUS"] as const) {
      const catData = categoryDefaultsMap[cat];
      const count = catData.ids.length;
      const hasConflict = count > 1;
      const hasInactiveDefault = catData.inactiveCount > 0;

      let resolution = "OK: Compliant with single-default invariant.";
      if (count === 0) {
        if (cat === "OPEN") {
          resolution = "WARNING: No default OPEN status configured. Recommending assigning lowest displayOrder active status as default.";
        } else {
          resolution = "OK: Category has no default status (optional for WON/LOST).";
        }
      } else if (hasConflict) {
        companyHasConflict = true;
        resolution = `CRITICAL CONFLICT: ${count} default statuses detected in category ${cat} (${catData.names.join(", ")}). Must designate exactly 1 default before applying partial unique index.`;
      }

      if (hasInactiveDefault) {
        companyHasConflict = true;
        resolution += " CRITICAL: Inactive status cannot be default. Must activate status or clear isDefault.";
      }

      defaultCategoryAudits[cat] = {
        category: cat,
        defaultCount: count,
        defaultStatusIds: catData.ids,
        defaultStatusNames: catData.names,
        hasConflict,
        hasInactiveDefault,
        recommendedResolution: resolution,
      };
    }

    if (companyHasConflict) {
      globalConflictsCount++;
      companiesWithConflicts.push(company.name);
    }

    companyReports.push({
      companyId: company.id,
      companyName: company.name,
      totalStatuses: statuses.length,
      totalLeads: companyLeads,
      statuses: statusAuditItems,
      defaultCategoryAudits,
      hasAnyConflict: companyHasConflict,
      summary: {
        openStatusesCount: openCount,
        wonStatusesCount: wonCount,
        lostStatusesCount: lostCount,
        ambiguousStatusesCount: ambiguousCount,
        leadsInOpen: openLeads,
        leadsInWon: wonLeads,
        leadsInLost: lostLeads,
        leadsInAmbiguous: ambiguousLeads,
      },
    });
  }

  const catalogList = Array.from(catalogMap.values()).sort((a, b) => b.totalLeads - a.totalLeads);

  return {
    timestamp: new Date().toISOString(),
    companiesAudited: companies.length,
    totalStatuses: totalStatusesCount,
    totalLeads: totalLeadsCount,
    globalConflictsCount,
    companiesWithConflicts,
    companyReports,
    statusClassificationCatalog: catalogList,
    migrationReadinessVerdict: globalConflictsCount === 0 ? "READY" : "BLOCKED_BY_CONFLICTS",
    readOnlyVerification: true,
  };
}

/**
 * Formats the dry-run report into human-readable text for review.
 */
export function formatReport(report: DryRunGlobalReport): string {
  const lines: string[] = [];
  lines.push("================================================================================");
  lines.push(" PHASE 8: STATUS CLASSIFICATION & DEFAULT CONFLICT DRY-RUN REPORT");
  lines.push(" MODE: 100% READ ONLY (Zero database mutations executed)");
  lines.push(` TIMESTAMP: ${report.timestamp}`);
  lines.push("================================================================================");
  lines.push("");
  lines.push("EXECUTIVE SUMMARY:");
  lines.push(`- Total Tenant Companies Audited: ${report.companiesAudited}`);
  lines.push(`- Total Status Definitions:        ${report.totalStatuses}`);
  lines.push(`- Total Active Leads Inspected:    ${report.totalLeads}`);
  lines.push(`- Default Status Conflicts Found:  ${report.globalConflictsCount}`);
  lines.push(`- Migration Readiness Verdict:     ${report.migrationReadinessVerdict}`);
  lines.push("");

  if (report.globalConflictsCount > 0) {
    lines.push("⚠️ ATTENTION: CONFLICTS DETECTED THAT REQUIRE HUMAN RESOLUTION BEFORE MIGRATION:");
    for (const compName of report.companiesWithConflicts) {
      lines.push(`  - Company: "${compName}"`);
    }
    lines.push("");
  } else {
    lines.push("✅ VERIFIED: Zero default status conflicts detected across all tenant companies.");
    lines.push("   The partial unique index `lead_statuses_single_default_per_company_category_idx` can safely be created.");
    lines.push("");
  }

  lines.push("--------------------------------------------------------------------------------");
  lines.push("GLOBAL STATUS CLASSIFICATION TAXONOMY CATALOG");
  lines.push("--------------------------------------------------------------------------------");
  lines.push(
    `| ${"Status Name".padEnd(20)} | ${"Category".padEnd(10)} | ${"Occurrences".padEnd(12)} | ${"Leads".padEnd(8)} |`
  );
  lines.push(`| ${"-".repeat(20)} | ${"-".repeat(10)} | ${"-".repeat(12)} | ${"-".repeat(8)} |`);
  for (const item of report.statusClassificationCatalog) {
    lines.push(
      `| ${item.statusName.padEnd(20)} | ${item.proposedCategory.padEnd(10)} | ${String(item.totalOccurrences).padEnd(12)} | ${String(item.totalLeads).padEnd(8)} |`
    );
  }
  lines.push("");

  lines.push("--------------------------------------------------------------------------------");
  lines.push("TENANT-BY-TENANT AUDIT DETAILS");
  lines.push("--------------------------------------------------------------------------------");

  for (const comp of report.companyReports) {
    lines.push(`\nCOMPANY: [${comp.companyId}] "${comp.companyName}"`);
    lines.push(`  Statuses: ${comp.totalStatuses} | Total Leads: ${comp.totalLeads}`);
    lines.push(`  Leads by Proposed Category:`);
    lines.push(`    - OPEN:      ${comp.summary.leadsInOpen} leads across ${comp.summary.openStatusesCount} statuses`);
    lines.push(`    - WON:       ${comp.summary.leadsInWon} leads across ${comp.summary.wonStatusesCount} statuses`);
    lines.push(`    - LOST:      ${comp.summary.leadsInLost} leads across ${comp.summary.lostStatusesCount} statuses`);
    if (comp.summary.ambiguousStatusesCount > 0) {
      lines.push(`    - AMBIGUOUS: ${comp.summary.leadsInAmbiguous} leads across ${comp.summary.ambiguousStatusesCount} statuses (Policy: Keep OPEN)`);
    }

    lines.push("  Default Status Audit by Category:");
    for (const cat of ["OPEN", "WON", "LOST", "AMBIGUOUS"]) {
      const d = comp.defaultCategoryAudits[cat];
      if (!d) continue;
      const statusNamesStr = d.defaultStatusNames.length > 0 ? `("${d.defaultStatusNames.join('", "')}")` : "(None)";
      const conflictFlag = d.hasConflict ? "❌ CONFLICT" : "✅ OK";
      const inactiveFlag = d.hasInactiveDefault ? "❌ INACTIVE DEFAULT" : "";
      lines.push(`    • ${cat.padEnd(9)}: ${d.defaultCount} default(s) ${statusNamesStr} — ${conflictFlag} ${inactiveFlag}`);
      lines.push(`      Resolution: ${d.recommendedResolution}`);
    }

    lines.push("  Status Roster:");
    for (const s of comp.statuses) {
      const defMarker = s.isDefault ? "[DEFAULT]" : "         ";
      const actMarker = s.isActive ? "ACTIVE" : "INACTIVE";
      lines.push(
        `    - [${s.id}] ${s.name.padEnd(18)} ${defMarker} | Cat: ${s.proposedCategory.padEnd(9)} | Leads: ${String(s.leadCount).padEnd(4)} | ${actMarker}`
      );
    }
  }

  lines.push("");
  lines.push("================================================================================");
  lines.push(" GOVERNANCE / HUMAN AUTHORIZATION STOP GATE");
  lines.push("================================================================================");
  lines.push("No database mutations have occurred.");
  lines.push("No migrations have been applied.");
  lines.push("Dry-run completed. Awaiting explicit human authorization before Step 4: Apply Prisma Migrations.");
  lines.push("================================================================================");

  return lines.join("\n");
}

// Direct CLI Execution
if (require.main === module) {
  runStatusClassificationDryRun()
    .then((report) => {
      console.log(formatReport(report));
      process.exit(0);
    })
    .catch((err) => {
      console.error("Dry run execution failed with error:", err);
      process.exit(1);
    });
}
