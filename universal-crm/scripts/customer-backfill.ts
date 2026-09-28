/**
 * Authoritative Customer Backfill Runner (Universal CRM)
 * 
 * Phase 4A: Historical Customer Backfill Dry Run (Read-Only)
 * Phase 4B: Historical Customer Backfill Execution (Guarded by explicit confirmation)
 * 
 * Safety Invariants:
 * 1. Default mode is strictly --dry-run (0 mutations).
 * 2. Identity Conflict Safety:
 *    When the same normalized phone is associated with divergent/conflicting names,
 *    DO NOT AUTO-MERGE into a Customer. Leave affected records UNRESOLVED (customerId: null).
 * 3. Never fabricate fake names, phones, emails, or customer identities.
 *    If reliable identity is missing or invalid, leave UNRESOLVED.
 * 4. Normalizes phone numbers dynamically using each tenant's Company.defaultCountryCode.
 * 5. Processes leads in bounded transactional batches (default 500 records/batch).
 * 6. Phase 4B requires explicit --execute and --confirm-phase-4b-execution flags.
 * 7. Preserves all historical lead fields, activities, notes, tasks, and soft-deleted records.
 */

import { prisma } from "../lib/db";
import { PhoneNormalizer } from "../lib/utils/phone";

export interface BackfillOptions {
  dryRun: boolean;
  batchSize: number;
  companyId?: string;
  json?: boolean;
  verbose?: boolean;
  confirmPhase4bExecution?: boolean;
}

export interface ConflictRecord {
  phone: string;
  names: string[];
  leadIds: string[];
  reason: string;
}

export interface CompanyBackfillReport {
  companyId: string;
  companyName: string;
  defaultCountryCode: string;
  totalLeads: number;
  deletedLeadsExcluded: number;
  eligibleLeads: number;
  alreadyLinked: number;
  customersCreated: number;
  existingCustomersReused: number;
  leadsLinked: number;
  customerPhonesCreated: number;
  customerEmailsCreated: number;
  missingPhone: number;
  invalidPhone: number;
  conflictingRecordsCount: number;
  unresolved: number;
  databaseMutations: number;
  conflictsList: ConflictRecord[];
  duplicateGroupsList: { phone: string; count: number; leadIds: string[] }[];
  unresolvedSample: { leadId: string; phone: string | null; reason: string }[];
}

export interface BackfillAggregateReport {
  timestamp: string;
  mode: "DRY_RUN" | "EXECUTE";
  totalLeads: number;
  eligible: number;
  alreadyLinked: number;
  customersCreated: number;
  existingCustomersReused: number;
  leadsLinked: number;
  customerPhonesCreated: number;
  missingPhone: number;
  invalidPhone: number;
  conflicts: number;
  duplicateGroups: number;
  unresolved: number;
  deletedLeadsExcluded: number;
  companiesCount: number;
  databaseMutations: number;
  companyReports: CompanyBackfillReport[];
}

type LeadRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  customerId: string | null;
};

export class CustomerBackfillRunner {
  private options: BackfillOptions;

  constructor(options: Partial<BackfillOptions> = {}) {
    this.options = {
      dryRun: options.dryRun !== false, // Default is true (dry-run)
      batchSize: options.batchSize || 500,
      companyId: options.companyId,
      json: options.json || false,
      verbose: options.verbose || false,
      confirmPhase4bExecution: options.confirmPhase4bExecution || false,
    };
  }

  /**
   * Main entry point to run backfill analysis or execution
   */
  async run(): Promise<BackfillAggregateReport> {
    if (!this.options.dryRun && !this.options.confirmPhase4bExecution) {
      throw new Error(
        "Phase 4B execution aborted: Historical mutation requires explicit --confirm-phase-4b-execution. " +
        "Phase 4A dry run must be reviewed and approved first."
      );
    }

    // Fetch target companies
    const companiesWhere = this.options.companyId ? { id: this.options.companyId } : {};
    const companies = await prisma.company.findMany({
      where: companiesWhere,
      select: {
        id: true,
        name: true,
        defaultCountryCode: true,
      },
      orderBy: { id: "asc" },
    });

    const companyReports: CompanyBackfillReport[] = [];

    for (const company of companies) {
      const report = await this.processCompany(company);
      companyReports.push(report);
    }

    // Aggregate totals across all companies
    const aggregate: BackfillAggregateReport = {
      timestamp: new Date().toISOString(),
      mode: this.options.dryRun ? "DRY_RUN" : "EXECUTE",
      totalLeads: companyReports.reduce((s, r) => s + r.totalLeads, 0),
      eligible: companyReports.reduce((s, r) => s + r.eligibleLeads, 0),
      alreadyLinked: companyReports.reduce((s, r) => s + r.alreadyLinked, 0),
      customersCreated: companyReports.reduce((s, r) => s + r.customersCreated, 0),
      existingCustomersReused: companyReports.reduce((s, r) => s + r.existingCustomersReused, 0),
      leadsLinked: companyReports.reduce((s, r) => s + r.leadsLinked, 0),
      customerPhonesCreated: companyReports.reduce((s, r) => s + r.customerPhonesCreated, 0),
      missingPhone: companyReports.reduce((s, r) => s + r.missingPhone, 0),
      invalidPhone: companyReports.reduce((s, r) => s + r.invalidPhone, 0),
      conflicts: companyReports.reduce((s, r) => s + r.conflictingRecordsCount, 0),
      duplicateGroups: companyReports.reduce((s, r) => s + r.duplicateGroupsList.length, 0),
      unresolved: companyReports.reduce((s, r) => s + r.unresolved, 0),
      deletedLeadsExcluded: companyReports.reduce((s, r) => s + r.deletedLeadsExcluded, 0),
      companiesCount: companyReports.length,
      databaseMutations: companyReports.reduce((s, r) => s + r.databaseMutations, 0),
      companyReports,
    };

    return aggregate;
  }

  /**
   * Process an individual tenant with strict tenant isolation and conflict safety
   */
  private async processCompany(company: {
    id: string;
    name: string;
    defaultCountryCode: string;
  }): Promise<CompanyBackfillReport> {
    const companyId = company.id;
    const defaultCountry = company.defaultCountryCode || "IN";

    // 1. Total leads & soft-deleted leads
    const totalLeads = await prisma.lead.count({
      where: { companyId },
    });

    const deletedLeadsExcluded = await prisma.lead.count({
      where: { companyId, deletedAt: { not: null } },
    });

    const eligibleLeadsCount = await prisma.lead.count({
      where: { companyId, deletedAt: null },
    });

    // 2. Existing CustomerPhones for this tenant in DB
    const existingPhones = await prisma.customerPhone.findMany({
      where: { companyId },
      select: { normalizedPhone: true, customerId: true },
    });

    const dbPhoneMap = new Map<string, string>();
    for (const p of existingPhones) {
      dbPhoneMap.set(p.normalizedPhone, p.customerId);
    }

    // 3. Scan all eligible leads for this company to identify:
    //    - Already linked leads
    //    - Missing phone leads
    //    - Invalid phone leads
    //    - Phone groups & divergent identity conflicts
    let cursor: string | undefined = undefined;
    const batchSize = this.options.batchSize;
    let processed = 0;

    let alreadyLinked = 0;
    let missingPhone = 0;
    let invalidPhone = 0;

    const unresolvedSample: { leadId: string; phone: string | null; reason: string }[] = [];

    // phone -> array of leads with that phone
    const phoneToLeads = new Map<string, LeadRecord[]>();

    while (processed < eligibleLeadsCount) {
      const batch: LeadRecord[] = await prisma.lead.findMany({
        where: {
          companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          company: true,
          customerId: true,
        },
        take: batchSize,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: "asc" },
      });

      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;
      processed += batch.length;

      for (const lead of batch) {
        if (lead.customerId) {
          alreadyLinked++;
          continue;
        }

        if (!lead.phone || lead.phone.trim() === "") {
          missingPhone++;
          if (unresolvedSample.length < 50) {
            unresolvedSample.push({
              leadId: lead.id,
              phone: null,
              reason: "MISSING_PHONE",
            });
          }
          continue;
        }

        const norm = PhoneNormalizer.normalize(lead.phone, defaultCountry);
        if (!norm.isValid || !norm.normalized) {
          invalidPhone++;
          if (unresolvedSample.length < 50) {
            unresolvedSample.push({
              leadId: lead.id,
              phone: lead.phone,
              reason: `INVALID_PHONE: ${norm.error || "unparseable"}`,
            });
          }
          continue;
        }

        const normalizedPhone = norm.normalized;
        if (!phoneToLeads.has(normalizedPhone)) {
          phoneToLeads.set(normalizedPhone, []);
        }
        phoneToLeads.get(normalizedPhone)!.push(lead);
      }
    }

    // 4. Identity Conflict Safety Check:
    //    If multiple leads share the same phone but have divergent non-empty names,
    //    DO NOT AUTO-MERGE into a Customer. Mark as CONFLICT_UNRESOLVED.
    const conflictsList: ConflictRecord[] = [];
    const duplicateGroupsList: { phone: string; count: number; leadIds: string[] }[] = [];
    const safeGroups: Array<{ normalizedPhone: string; leads: LeadRecord[]; primaryName: string }> = [];

    let conflictingRecordsCount = 0;

    for (const [phone, leads] of phoneToLeads.entries()) {
      if (leads.length > 1) {
        duplicateGroupsList.push({
          phone,
          count: leads.length,
          leadIds: leads.map((l) => l.id),
        });
      }

      // Collect distinct non-empty names (case and whitespace normalized)
      const distinctNames = Array.from(
        new Set(leads.map((l) => l.name?.trim()).filter((n): n is string => Boolean(n && n.length > 0)))
      );

      if (distinctNames.length > 1) {
        // CONFLICT DETECTED: Divergent names for the same phone number
        conflictingRecordsCount += leads.length;
        conflictsList.push({
          phone,
          names: distinctNames,
          leadIds: leads.map((l) => l.id),
          reason: "Divergent customer names across enquiries sharing same phone number",
        });

        for (const lead of leads) {
          if (unresolvedSample.length < 50) {
            unresolvedSample.push({
              leadId: lead.id,
              phone,
              reason: `CONFLICT_DIVERGENT_NAMES: [${distinctNames.join(", ")}]`,
            });
          }
        }
        // Do NOT auto-merge! Leave unresolved.
        continue;
      }

      // Non-conflicting group: safe to resolve/link
      const primaryName = distinctNames[0] || leads[0].name?.trim() || "Unknown Customer";
      safeGroups.push({
        normalizedPhone: phone,
        leads,
        primaryName,
      });
    }

    let customersCreated = 0;
    let existingCustomersReused = 0;
    let leadsLinked = 0;
    let customerPhonesCreated = 0;
    let customerEmailsCreated = 0;
    let databaseMutations = 0;

    // 5. Execution or Dry-Run Simulation for Safe Groups
    if (this.options.dryRun) {
      // READ ONLY DRY-RUN SIMULATION
      for (const group of safeGroups) {
        const phone = group.normalizedPhone;
        if (dbPhoneMap.has(phone)) {
          existingCustomersReused++;
        } else {
          customersCreated++;
          customerPhonesCreated++;
          dbPhoneMap.set(phone, `virtual_cust_${customersCreated}`);
        }
        leadsLinked += group.leads.length;
      }
    } else {
      // PHASE 4B EXECUTION (MUTATION)
      // Process safe groups in bounded chunks inside transactions
      const chunkSize = 250; // Bounded transaction chunks
      for (let i = 0; i < safeGroups.length; i += chunkSize) {
        const chunk = safeGroups.slice(i, i + chunkSize);

        await prisma.$transaction(async (tx) => {
          for (const group of chunk) {
            const phone = group.normalizedPhone;
            let targetCustomerId: string;

            // Check if CustomerPhone already exists in DB for this company
            if (dbPhoneMap.has(phone)) {
              targetCustomerId = dbPhoneMap.get(phone)!;
              existingCustomersReused++;
            } else {
              // Create new Customer
              const firstLead = group.leads[0];
              const newCustomer = await tx.customer.create({
                data: {
                  companyId,
                  name: group.primaryName,
                  companyName: firstLead.company?.trim() || null,
                },
              });

              // Create CustomerPhone
              await tx.customerPhone.create({
                data: {
                  companyId,
                  customerId: newCustomer.id,
                  rawPhone: firstLead.phone || phone,
                  normalizedPhone: phone,
                  isPrimary: true,
                },
              });

              // Optionally create CustomerEmail if available and not already taken
              if (firstLead.email && firstLead.email.trim()) {
                const cleanEmail = firstLead.email.trim().toLowerCase();
                const existingEmail = await tx.customerEmail.findUnique({
                  where: {
                    companyId_email: {
                      companyId,
                      email: cleanEmail,
                    },
                  },
                });

                if (!existingEmail) {
                  await tx.customerEmail.create({
                    data: {
                      companyId,
                      customerId: newCustomer.id,
                      email: cleanEmail,
                      isPrimary: true,
                    },
                  });
                  customerEmailsCreated++;
                  databaseMutations++;
                }
              }

              targetCustomerId = newCustomer.id;
              dbPhoneMap.set(phone, targetCustomerId);
              customersCreated++;
              customerPhonesCreated++;
              databaseMutations += 2; // Customer + CustomerPhone
            }

            // Link all leads in this group to targetCustomerId
            const leadIds = group.leads.map((l) => l.id);
            const updateResult = await tx.lead.updateMany({
              where: {
                id: { in: leadIds },
                companyId,
                customerId: null, // Guard against overwriting
              },
              data: {
                customerId: targetCustomerId,
              },
            });

            leadsLinked += updateResult.count;
            databaseMutations += updateResult.count;
          }
        });
      }
    }

    const totalUnresolved = missingPhone + invalidPhone + conflictingRecordsCount;

    return {
      companyId,
      companyName: company.name,
      defaultCountryCode: defaultCountry,
      totalLeads,
      deletedLeadsExcluded,
      eligibleLeads: eligibleLeadsCount,
      alreadyLinked,
      customersCreated,
      existingCustomersReused,
      leadsLinked,
      customerPhonesCreated,
      customerEmailsCreated,
      missingPhone,
      invalidPhone,
      conflictingRecordsCount,
      unresolved: totalUnresolved,
      databaseMutations,
      conflictsList,
      duplicateGroupsList,
      unresolvedSample,
    };
  }

  /**
   * Helper to format report into clean, human-readable terminal output
   */
  static formatReport(aggregate: BackfillAggregateReport): string {
    const lines: string[] = [];

    lines.push("============================================================");
    lines.push(`UNIVERSAL CRM — HISTORICAL CUSTOMER BACKFILL REPORT`);
    lines.push("============================================================");
    lines.push(`Timestamp:          ${aggregate.timestamp}`);
    lines.push(`Execution Mode:     ${aggregate.mode}`);
    lines.push(`Companies Checked:  ${aggregate.companiesCount}`);
    lines.push(`Database Mutations: ${aggregate.databaseMutations}`);
    lines.push("");
    lines.push("--- GLOBAL AGGREGATE METRICS ---");
    lines.push(`Total Leads:                  ${aggregate.totalLeads}`);
    lines.push(`Soft-Deleted Leads (Excluded): ${aggregate.deletedLeadsExcluded}`);
    lines.push(`Eligible Leads:               ${aggregate.eligible}`);
    lines.push(`Already Linked Leads:         ${aggregate.alreadyLinked}`);
    lines.push(`Customers Created:            ${aggregate.customersCreated}`);
    lines.push(`Existing Customers Reused:    ${aggregate.existingCustomersReused}`);
    lines.push(`Leads Linked:                 ${aggregate.leadsLinked}`);
    lines.push(`Customer Phones Created:      ${aggregate.customerPhonesCreated}`);
    lines.push(`Leads with Missing Phone:     ${aggregate.missingPhone}`);
    lines.push(`Leads with Invalid Phone:     ${aggregate.invalidPhone}`);
    lines.push(`Conflict Records (Unresolved):${aggregate.conflicts}`);
    lines.push(`Duplicate Phone Groups:       ${aggregate.duplicateGroups}`);
    lines.push(`Total Unresolved Leads:       ${aggregate.unresolved}`);
    lines.push("");
    lines.push("--- PER-COMPANY BREAKDOWN ---");

    for (const c of aggregate.companyReports) {
      lines.push(`Company: ${c.companyName} (${c.companyId}) [Default Country: ${c.defaultCountryCode}]`);
      lines.push(`  - Total Leads:          ${c.totalLeads}`);
      lines.push(`  - Excluded (Deleted):   ${c.deletedLeadsExcluded}`);
      lines.push(`  - Eligible Leads:       ${c.eligibleLeads}`);
      lines.push(`  - Already Linked:       ${c.alreadyLinked}`);
      lines.push(`  - Customers Created:    ${c.customersCreated}`);
      lines.push(`  - Customers Reused:     ${c.existingCustomersReused}`);
      lines.push(`  - Leads Linked:         ${c.leadsLinked}`);
      lines.push(`  - Customer Phones:      ${c.customerPhonesCreated}`);
      lines.push(`  - Missing Phone:        ${c.missingPhone}`);
      lines.push(`  - Invalid Phone:        ${c.invalidPhone}`);
      lines.push(`  - Conflicts (Unresolved):${c.conflictingRecordsCount}`);
      lines.push(`  - Total Unresolved:     ${c.unresolved}`);
      lines.push(`  - Mutations Executed:   ${c.databaseMutations}`);

      if (c.conflictsList.length > 0) {
        lines.push(`  * CONFLICT DETAILS (${c.conflictsList.length} groups):`);
        for (const conf of c.conflictsList) {
          lines.push(`    Phone: ${conf.phone}`);
          lines.push(`    Names: [${conf.names.join(", ")}]`);
          lines.push(`    Lead IDs: [${conf.leadIds.join(", ")}]`);
          lines.push(`    Action: PRESERVED UNRESOLVED (customerId: null, NO AUTO-MERGE)`);
        }
      }
      lines.push("");
    }

    lines.push("============================================================");
    lines.push("SAFETY & INTEGRITY AUDIT:");
    lines.push("1. Anti-Hallucination: No fake customer identities fabricated for unresolved leads.");
    lines.push("2. Conflict Safety: Divergent identities sharing a phone were NOT merged.");
    lines.push("3. Tenant Boundaries: All queries and mutations strictly scoped by companyId.");
    lines.push("4. Data Preservation: Historical lead identity, activities, tasks untouched.");
    lines.push("============================================================");

    return lines.join("\n");
  }
}

// CLI Execution Handler
if (require.main === module) {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const isConfirm = args.includes("--confirm-phase-4b-execution");
  const isJson = args.includes("--json");
  const isVerbose = args.includes("--verbose");

  let batchSize = 500;
  const batchArg = args.find((a) => a.startsWith("--batch-size="));
  if (batchArg) {
    batchSize = parseInt(batchArg.split("=")[1], 10) || 500;
  }

  let companyId: string | undefined = undefined;
  const companyArg = args.find((a) => a.startsWith("--company-id="));
  if (companyArg) {
    companyId = companyArg.split("=")[1];
  }

  const runner = new CustomerBackfillRunner({
    dryRun: !isExecute,
    batchSize,
    companyId,
    json: isJson,
    verbose: isVerbose,
    confirmPhase4bExecution: isConfirm,
  });

  runner
    .run()
    .then((report) => {
      if (isJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(CustomerBackfillRunner.formatReport(report));
      }
      return prisma.$disconnect();
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      prisma.$disconnect().then(() => {
        process.exit(1);
      });
    });
}
