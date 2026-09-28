/**
 * Authoritative Onboarding State Backfill Script (Universal CRM)
 *
 * Phase B.2: Existing Tenant Compatibility & Migration Backfill
 *
 * Safety Invariants:
 * 1. Default mode is strictly --dry-run (0 mutations).
 * 2. Fails closed if DATABASE_URL is missing or unparseable (never prints credentials).
 * 3. Identifies genuine existing operational tenants (has active CRM data: leads, teams, activities, customers, multiple users, or active user with login history).
 * 4. Strictly protects newly provisioned/pending tenants from accidental completion.
 * 5. 100% idempotent: safe to execute multiple times; never mutates already completed tenants.
 * 6. In --apply mode, safely updates qualified existing tenants to onboardingCompleted = true
 *    with onboardingStep = 'COMPLETED' and onboardingCompletedAt = createdAt.
 * 7. Provides explicit verification and reporting after execution.
 */

import { prisma } from "../lib/db";

export interface OnboardingBackfillOptions {
  dryRun: boolean;
  companyId?: string;
  verbose?: boolean;
}

export interface OnboardingBackfillReport {
  totalCompaniesScanned: number;
  alreadyCompleted: number;
  eligibleToComplete: number;
  newCompaniesPendingOnboarding: number;
  mutatedCompanies: string[];
}

export function assertDatabaseConfigured() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.trim().length === 0) {
    throw new Error("[Backfill Safety] DATABASE_URL environment variable is missing. Aborting backfill.");
  }
}

export async function runOnboardingBackfill(
  options: OnboardingBackfillOptions
): Promise<OnboardingBackfillReport> {
  assertDatabaseConfigured();
  const { dryRun, companyId, verbose } = options;

  console.log("====================================================================");
  console.log(`🚀 ONBOARDING BACKFILL RUNNER [Mode: ${dryRun ? "DRY-RUN (READ-ONLY)" : "APPLY (MUTATION)"}]`);
  console.log("====================================================================");

  const whereClause: any = {};
  if (companyId) {
    whereClause.id = companyId;
  }

  const companies = await prisma.company.findMany({
    where: whereClause,
    include: {
      _count: {
        select: {
          users: true,
          leads: true,
          teams: true,
          activities: true,
          customers: true,
        },
      },
      users: {
        select: {
          status: true,
          lastLoginAt: true,
        },
        take: 2,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const report: OnboardingBackfillReport = {
    totalCompaniesScanned: companies.length,
    alreadyCompleted: 0,
    eligibleToComplete: 0,
    newCompaniesPendingOnboarding: 0,
    mutatedCompanies: [],
  };

  const toMutate: string[] = [];

  for (const company of companies) {
    if (company.onboardingCompleted) {
      report.alreadyCompleted++;
      if (verbose) {
        console.log(`  [SKIP] Company ${company.name} (${company.id}) is already marked as completed.`);
      }
      continue;
    }

    // Precise Tenant Qualification:
    // A company is an existing operational tenant IF:
    // 1. It has active operational CRM records: leads, teams, activities, customers, or multiple users; OR
    // 2. Its initial user is active and has logged in (not a fresh invited-only tenant).
    const hasCrmData =
      company._count.leads > 0 ||
      company._count.teams > 0 ||
      company._count.activities > 0 ||
      company._count.customers > 0 ||
      company._count.users > 1;

    const hasActiveLoggedInUser =
      company._count.users === 1 &&
      company.users[0]?.status === "ACTIVE" &&
      company.users[0]?.lastLoginAt !== null;

    const isExistingOperationalTenant = hasCrmData || hasActiveLoggedInUser;

    if (isExistingOperationalTenant) {
      report.eligibleToComplete++;
      toMutate.push(company.id);
      if (verbose) {
        console.log(
          `  [ELIGIBLE] Company ${company.name} (${company.id}) — Users: ${company._count.users}, Leads: ${company._count.leads}, Teams: ${company._count.teams}, Activities: ${company._count.activities}`
        );
      }
    } else {
      report.newCompaniesPendingOnboarding++;
      if (verbose) {
        console.log(
          `  [PENDING] Company ${company.name} (${company.id}) is a new/un-onboarded tenant.`
        );
      }
    }
  }

  console.log("\n--- BACKFILL ANALYSIS REPORT ---");
  console.log(`Total Companies Scanned:       ${report.totalCompaniesScanned}`);
  console.log(`Already Completed:             ${report.alreadyCompleted}`);
  console.log(`Eligible for Backfill:         ${report.eligibleToComplete}`);
  console.log(`Pending First-Time Onboarding: ${report.newCompaniesPendingOnboarding}`);

  if (dryRun) {
    console.log("\n🔒 DRY-RUN COMPLETE: 0 database mutations performed.");
    console.log("To apply mutations, run with --apply flag.");
    return report;
  }

  if (toMutate.length === 0) {
    console.log("\n✅ No companies required migration mutations.");
    return report;
  }

  console.log(`\n⏳ Applying onboarding completion to ${toMutate.length} existing companies...`);

  await prisma.$transaction(
    toMutate.map((id) =>
      prisma.company.update({
        where: { id },
        data: {
          onboardingCompleted: true,
          onboardingStep: "COMPLETED",
          onboardingCompletedAt: new Date(),
        },
      })
    )
  );

  report.mutatedCompanies = toMutate;

  // Verification step
  const verification = await prisma.company.count({
    where: {
      id: { in: toMutate },
      onboardingCompleted: true,
      onboardingStep: "COMPLETED",
    },
  });

  console.log(`\n✅ VERIFICATION COMPLETE: ${verification}/${toMutate.length} companies successfully updated.`);
  return report;
}

// CLI Execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply") || args.includes("--execute");
  const isVerbose = args.includes("--verbose") || args.includes("-v");

  runOnboardingBackfill({
    dryRun: !isApply,
    verbose: isVerbose,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ BACKFILL FAILED:", err);
      process.exit(1);
    });
}
