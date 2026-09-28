/**
 * Integration Tests for Lead Import Engine (SKIP, UPDATE, CREATE modes)
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { LeadImportService } from "../lib/services/lead-import.service";
import { CustomFieldService } from "../lib/services/custom-field.service";
import { createDbSession, validateSessionToken } from "../lib/auth/session";

export async function runLeadImportIntegrationTests() {
  console.log("\n🧪 Running Lead Import Integration Tests...");

  const acmeAdmin = await prisma.user.findFirstOrThrow({
    where: { email: "admin@acmecorp.com" },
  });

  const adminSession = await createDbSession(acmeAdmin.id, acmeAdmin.companyId);
  const adminCtx = await validateSessionToken(adminSession.rawToken);
  assert.ok(adminCtx, "Acme admin context must exist");

  // Clean up any test leads from previous runs
  await prisma.lead.deleteMany({
    where: {
      companyId: adminCtx.company.id,
      email: { in: ["import.lead1@example.com", "import.lead2@example.com", "import.lead3@example.com"] },
    },
  });

  // Setup a custom field for the test
  let cf = await prisma.customField.findFirst({
    where: { companyId: adminCtx.company.id, key: "industry_sector", deletedAt: null },
  });
  if (!cf) {
    cf = await CustomFieldService.createCustomField(adminCtx, {
      key: "industry_sector",
      label: "Industry Sector",
      fieldType: "TEXT",
      active: true,
      required: false,
    });
  }

  // 1. Test preview
  console.log("  → [LeadImportService] Preview CSV parsing & auto-mapping...");
  const csvContent = `name,email,phone,company,industry_sector\nLead One,import.lead1@example.com,+1 555-9001,Alpha Corp,Aerospace\nLead Two,import.lead2@example.com,+1 555-9002,Beta LLC,Biotech`;

  const preview = await LeadImportService.previewImport(adminCtx, csvContent, "leads.csv");
  assert.equal(preview.totalRows, 2);
  assert.equal(preview.detectedHeaders.length, 5);
  assert.equal(preview.suggestedMappings["name"], "name");
  assert.equal(preview.suggestedMappings["email"], "email");

  // 2. Execute import with CREATE
  console.log("  → [LeadImportService] Execute import (mode: CREATE)...");
  const result1 = await LeadImportService.executeImport(adminCtx, {
    csvContent,
    filename: "leads.csv",
    columnMappings: {
      name: "name",
      email: "email",
      phone: "phone",
      company: "company",
      industry_sector: "cf_industry_sector",
    },
    duplicateStrategy: "CREATE",
  });

  assert.equal(result1.status, "COMPLETED");
  assert.equal(result1.totalRows, 2);
  assert.equal(result1.successfulRows, 2);
  assert.equal(result1.failedRows, 0);

  // Verify lead and custom field values exist
  const importedLead = await prisma.lead.findFirst({
    where: { companyId: adminCtx.company.id, email: "import.lead1@example.com" },
    include: { customFieldValues: true },
  });
  assert.ok(importedLead);
  assert.equal(importedLead.name, "Lead One");
  assert.equal(importedLead.company, "Alpha Corp");
  assert.equal(importedLead.customFieldValues.length, 1);
  assert.equal(importedLead.customFieldValues[0].value, "Aerospace");

  // 3. Execute duplicate import with SKIP
  console.log("  → [LeadImportService] Execute duplicate import (mode: SKIP)...");
  const result2 = await LeadImportService.executeImport(adminCtx, {
    csvContent,
    filename: "leads_duplicate.csv",
    columnMappings: {
      name: "name",
      email: "email",
    },
    duplicateStrategy: "SKIP",
  });

  assert.equal(result2.status, "COMPLETED");
  assert.equal(result2.totalRows, 2);
  assert.equal(result2.skippedRows, 2);
  assert.equal(result2.successfulRows, 0);

  // 4. Execute duplicate import with UPDATE
  console.log("  → [LeadImportService] Execute duplicate import (mode: UPDATE)...");
  const updateCsv = `name,email,company\nLead One Updated,import.lead1@example.com,Alpha Corp International`;
  const result3 = await LeadImportService.executeImport(adminCtx, {
    csvContent: updateCsv,
    filename: "leads_update.csv",
    columnMappings: {
      name: "name",
      email: "email",
      company: "company",
    },
    duplicateStrategy: "UPDATE",
  });

  assert.equal(result3.status, "COMPLETED");
  assert.equal(result3.updatedRows, 1);

  const updatedLead = await prisma.lead.findFirst({
    where: { companyId: adminCtx.company.id, email: "import.lead1@example.com" },
  });
  assert.equal(updatedLead?.name, "Lead One Updated");
  assert.equal(updatedLead?.company, "Alpha Corp International");

  // 5. Test history retrieval
  console.log("  → [LeadImportService] Retrieve import history & run details...");
  const history = await LeadImportService.listImports(adminCtx, { page: 1, limit: 10 });
  assert.ok(history.data.length >= 3);

  const singleRun = await LeadImportService.getImportById(adminCtx, result1.id);
  assert.equal(singleRun.id, result1.id);
  assert.equal(singleRun.totalRows, 2);

  // Cleanup
  await prisma.lead.deleteMany({
    where: {
      companyId: adminCtx.company.id,
      email: { in: ["import.lead1@example.com", "import.lead2@example.com"] },
    },
  });
  await prisma.leadImport.deleteMany({
    where: { id: { in: [result1.id, result2.id, result3.id] } },
  });
  await prisma.customField.delete({ where: { id: cf.id } });

  console.log("  ✅ Lead Import Integration Tests PASSED!");
}

if (require.main === module) {
  runLeadImportIntegrationTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
