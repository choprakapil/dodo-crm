/**
 * Unit & Integration Tests for Phase 4A/4B: Historical Customer Backfill & Conflict Safety
 * 
 * Verifies:
 * 1. Backfill dry-run is strictly READ ONLY.
 * 2. Zero database mutations during dry run.
 * 3. Soft-deleted leads are excluded from backfill.
 * 4. Missing and invalid phone numbers are left UNRESOLVED (no fake customers created).
 * 5. CONFLICT SAFETY: Divergent customer names sharing the same phone are NOT auto-merged.
 *    They remain unresolved with customerId = null.
 * 6. Non-conflicting valid phone leads are correctly linked to a newly created or existing Customer.
 * 7. Phase 4B execution accurately mutates only eligible records and preserves all other data.
 * 8. Execution safeguard prevents unauthorized mutation.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { CustomerBackfillRunner } from "../scripts/customer-backfill";

export async function runCustomerBackfillDryRunTests() {
  console.log("\n🧪 Running Phase 4A/4B Tests: Customer Backfill Execution & Conflict Safety...");

  const uniqueSuffix = Date.now().toString();

  // Create isolated test company with US default country
  const testCompany = await prisma.company.create({
    data: {
      name: `Backfill Test Corp US ${uniqueSuffix}`,
      slug: `backfill-test-us-${uniqueSuffix}`,
      defaultCountryCode: "US",
      currency: "USD",
    },
  });

  const _defaultRole = await prisma.role.create({
    data: {
      companyId: testCompany.id,
      name: `ROLE_BACKFILL_${uniqueSuffix}`,
      description: "Backfill Role",
      isSystem: false,
    },
  });

  const defaultStatus = await prisma.leadStatus.create({
    data: {
      companyId: testCompany.id,
      name: "New",
      isDefault: true,
      displayOrder: 1,
    },
  });

  const defaultSource = await prisma.leadSource.create({
    data: {
      companyId: testCompany.id,
      name: "Inbound",
      isActive: true,
    },
  });

  // Create existing customer in DB for Lead 7 to be already linked
  const existingCustomer = await prisma.customer.create({
    data: {
      companyId: testCompany.id,
      name: "Existing Customer",
    },
  });

  await prisma.customerPhone.create({
    data: {
      companyId: testCompany.id,
      customerId: existingCustomer.id,
      rawPhone: "+15550001111",
      normalizedPhone: "+15550001111",
      isPrimary: true,
    },
  });

  // Seed test leads:
  // Lead 1: Conflicting group member A
  const lead1 = await prisma.lead.create({
    data: {
      companyId: testCompany.id,
      name: "Alice Smith",
      phone: "5552345678",
      sourceId: defaultSource.id,
      statusId: defaultStatus.id,
    },
  });

  // Lead 2: Conflicting group member B (same phone +15552345678, divergent name!)
  const lead2 = await prisma.lead.create({
    data: {
      companyId: testCompany.id,
      name: "Alice In Wonderland",
      phone: "+1 (555) 234-5678",
      sourceId: defaultSource.id,
      statusId: defaultStatus.id,
    },
  });

  // Lead 3: Non-conflicting clean lead
  const lead3 = await prisma.lead.create({
    data: {
      companyId: testCompany.id,
      name: "Clean Lead Bob",
      phone: "5553334444", // -> +15553334444
      sourceId: defaultSource.id,
      statusId: defaultStatus.id,
    },
  });

  // Lead 4: Missing phone lead
  const lead4 = await prisma.lead.create({
    data: {
      companyId: testCompany.id,
      name: "No Phone Lead",
      phone: null,
      sourceId: defaultSource.id,
      statusId: defaultStatus.id,
    },
  });

  // Lead 5: Invalid phone lead
  const lead5 = await prisma.lead.create({
    data: {
      companyId: testCompany.id,
      name: "Invalid Phone Lead",
      phone: "123",
      sourceId: defaultSource.id,
      statusId: defaultStatus.id,
    },
  });

  // Lead 6: Soft-deleted lead
  await prisma.lead.create({
    data: {
      companyId: testCompany.id,
      name: "Deleted Lead",
      phone: "+15559998888",
      deletedAt: new Date(),
      sourceId: defaultSource.id,
      statusId: defaultStatus.id,
    },
  });

  // Lead 7: Already linked to existing customer
  await prisma.lead.create({
    data: {
      companyId: testCompany.id,
      name: "Already Linked Lead",
      phone: "+15550001111",
      customerId: existingCustomer.id,
      sourceId: defaultSource.id,
      statusId: defaultStatus.id,
    },
  });

  // =========================================================================
  // STEP 1: Dry-Run Verification (Read-Only)
  // =========================================================================
  const customerCountBefore = await prisma.customer.count();
  const phoneCountBefore = await prisma.customerPhone.count();
  const leadCountBefore = await prisma.lead.count();

  const dryRunner = new CustomerBackfillRunner({
    dryRun: true,
    companyId: testCompany.id,
    batchSize: 10,
  });

  const dryReport = await dryRunner.run();

  const customerCountAfterDry = await prisma.customer.count();
  const phoneCountAfterDry = await prisma.customerPhone.count();
  const leadCountAfterDry = await prisma.lead.count();

  assert.equal(customerCountAfterDry, customerCountBefore, "Dry-run must not create customers");
  assert.equal(phoneCountAfterDry, phoneCountBefore, "Dry-run must not create phones");
  assert.equal(leadCountAfterDry, leadCountBefore, "Dry-run must not touch leads");
  assert.equal(dryReport.databaseMutations, 0, "Reported database mutations in dry-run must be 0");
  assert.equal(dryReport.mode, "DRY_RUN", "Runner mode must be DRY_RUN");

  const cDryReport = dryReport.companyReports[0];
  assert.equal(cDryReport.totalLeads, 7, "Total leads should be 7 (including soft-deleted)");
  assert.equal(cDryReport.deletedLeadsExcluded, 1, "Should exclude 1 soft-deleted lead");
  assert.equal(cDryReport.eligibleLeads, 6, "Eligible leads should be 6");
  assert.equal(cDryReport.alreadyLinked, 1, "Should detect 1 already linked lead");
  assert.equal(cDryReport.missingPhone, 1, "Should detect 1 missing phone lead");
  assert.equal(cDryReport.invalidPhone, 1, "Should detect 1 invalid phone lead");
  assert.equal(cDryReport.conflictingRecordsCount, 2, "Should detect 2 conflicting records (Lead 1 & 2)");
  assert.equal(cDryReport.unresolved, 4, "Should have 4 unresolved leads (1 missing + 1 invalid + 2 conflict)");
  assert.equal(cDryReport.customersCreated, 1, "Should plan 1 customer for the clean lead Bob");
  assert.equal(cDryReport.leadsLinked, 1, "Should plan 1 lead linked (Clean Lead Bob)");

  // =========================================================================
  // STEP 2: Safeguard Check (Reject Unconfirmed Execution)
  // =========================================================================
  const unsafeRunner = new CustomerBackfillRunner({
    dryRun: false,
    companyId: testCompany.id,
    confirmPhase4bExecution: false,
  });

  await assert.rejects(
    async () => {
      await unsafeRunner.run();
    },
    /Phase 4B execution aborted/,
    "Runner must reject execution when confirmPhase4bExecution is false"
  );

  // =========================================================================
  // STEP 3: Phase 4B Confirmed Execution
  // =========================================================================
  const execRunner = new CustomerBackfillRunner({
    dryRun: false,
    companyId: testCompany.id,
    confirmPhase4bExecution: true,
    batchSize: 10,
  });

  const execReport = await execRunner.run();

  assert.equal(execReport.mode, "EXECUTE", "Mode must be EXECUTE");
  const cExecReport = execReport.companyReports[0];
  assert.equal(cExecReport.customersCreated, 1, "Must create exactly 1 customer for clean lead Bob");
  assert.equal(cExecReport.customerPhonesCreated, 1, "Must create exactly 1 phone for Bob");
  assert.equal(cExecReport.leadsLinked, 1, "Must link exactly 1 lead (Bob)");
  assert.equal(cExecReport.conflictingRecordsCount, 2, "Must report 2 conflict records");
  assert.equal(cExecReport.unresolved, 4, "Must leave 4 records unresolved");

  // =========================================================================
  // STEP 4: Database State Verification After Execution
  // =========================================================================
  // 1. Verify Clean Lead Bob is linked to a valid Customer
  const refreshedBob = await prisma.lead.findUnique({ where: { id: lead3.id } });
  assert.ok(refreshedBob?.customerId, "Bob must be linked to a customer");
  const bobCustomer = await prisma.customer.findUnique({
    where: { id: refreshedBob.customerId! },
    include: { phones: true },
  });
  assert.ok(bobCustomer, "Bob's customer record must exist in DB");
  assert.equal(bobCustomer.companyId, testCompany.id, "Customer must match tenant companyId");
  assert.equal(bobCustomer.name, "Clean Lead Bob");
  assert.equal(bobCustomer.phones[0].normalizedPhone, "+15553334444");
  assert.equal(bobCustomer.phones[0].companyId, testCompany.id);

  // 2. CONFLICT SAFETY: Verify divergent Alice leads are NOT auto-merged
  const refreshedAlice1 = await prisma.lead.findUnique({ where: { id: lead1.id } });
  const refreshedAlice2 = await prisma.lead.findUnique({ where: { id: lead2.id } });
  assert.equal(
    refreshedAlice1?.customerId,
    null,
    "Conflicting Alice 1 must remain customerId = null (NO AUTO-MERGE)"
  );
  assert.equal(
    refreshedAlice2?.customerId,
    null,
    "Conflicting Alice 2 must remain customerId = null (NO AUTO-MERGE)"
  );

  // 3. ANTI-HALLUCINATION: Verify missing/invalid phone leads remain customerId = null
  const refreshedNoPhone = await prisma.lead.findUnique({ where: { id: lead4.id } });
  const refreshedInvalidPhone = await prisma.lead.findUnique({ where: { id: lead5.id } });
  assert.equal(refreshedNoPhone?.customerId, null, "Missing phone lead must remain null");
  assert.equal(refreshedInvalidPhone?.customerId, null, "Invalid phone lead must remain null");

  // Clean up test data
  await prisma.lead.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.customerPhone.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.customer.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.leadSource.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.leadStatus.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.role.deleteMany({ where: { companyId: testCompany.id } });
  await prisma.company.delete({ where: { id: testCompany.id } });

  console.log("  ✅ Customer Backfill Dry Run & Conflict Safety Tests Passed!");
}

if (require.main === module) {
  runCustomerBackfillDryRunTests()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error(err);
      prisma.$disconnect().then(() => process.exit(1));
    });
}
