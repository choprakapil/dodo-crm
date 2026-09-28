/**
 * Security & Data-Scope Tests for Lead Export Engine
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { LeadExportService } from "../lib/services/lead-export.service";
import { parseCsv } from "../lib/utils/csv";

export async function runLeadExportSecurityTests() {
  console.log("\n🔒 Running Lead Export Security & Data-Scope Tests...");

  const [acmeAdmin, acmeRep, zenithAdmin] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: "admin@acmecorp.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "sarah@acmecorp.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "admin@zenithsolutions.com" } }),
  ]);

  const [adminSession, repSession, zenithSession] = await Promise.all([
    createDbSession(acmeAdmin.id, acmeAdmin.companyId),
    createDbSession(acmeRep.id, acmeRep.companyId),
    createDbSession(zenithAdmin.id, zenithAdmin.companyId),
  ]);

  const [adminCtx, repCtx, zenithCtx] = await Promise.all([
    validateSessionToken(adminSession.rawToken),
    validateSessionToken(repSession.rawToken),
    validateSessionToken(zenithSession.rawToken),
  ]);

  assert.ok(adminCtx);
  assert.ok(repCtx);
  assert.ok(zenithCtx);

  // 1. Cross-Tenant Isolation
  console.log("  → [Cross-Tenant] Acme export must contain ZERO Zenith leads...");
  const acmeResult = await LeadExportService.exportLeadsCsv(adminCtx, {});
  const zenithResult = await LeadExportService.exportLeadsCsv(zenithCtx, {});

  const acmeParsed = parseCsv(acmeResult.csv);
  const zenithParsed = parseCsv(zenithResult.csv);

  const acmeEmails = acmeParsed.rows.map((r) => r["Email"]);
  const zenithEmails = zenithParsed.rows.map((r) => r["Email"]);

  for (const email of acmeEmails) {
    if (email) {
      assert.ok(!zenithEmails.includes(email), `Zenith export leaked Acme lead: ${email}`);
    }
  }

  // 2. Data-Scope Isolation: Sales Rep (OWN scope)
  console.log("  → [Data Scope] Rep (OWN scope) export must only contain leads assigned to or created by Rep...");
  const repResult = await LeadExportService.exportLeadsCsv(repCtx, {});
  const repParsed = parseCsv(repResult.csv);
  const repExportedEmails = repParsed.rows.map((r) => r["Email"]);

  // Query actual leads owned by rep in DB
  const actualRepLeads = await prisma.lead.findMany({
    where: {
      companyId: acmeAdmin.companyId,
      deletedAt: null,
      assignedUserId: acmeRep.id,
    },
    select: { email: true },
  });
  const actualRepEmails = actualRepLeads.map((l: { email: string | null }) => l.email).filter(Boolean) as string[];

  for (const email of repExportedEmails) {
    if (email) {
      assert.ok(
        actualRepEmails.includes(email),
        `Rep export contained lead not assigned to rep: ${email}`
      );
    }
  }

  // 3. Formula Injection Neutralization in CSV Export
  console.log("  → [Formula Injection] Export must neutralize dangerous spreadsheet prefixes (=, +, -, @)...");
  const injectionEmail = `formula-${Date.now()}@example.com`;
  await prisma.lead.create({
    data: {
      companyId: acmeAdmin.companyId,
      name: "=SUM(A1:A10)",
      email: injectionEmail,
      company: "+CMD|' /C calc'!A0",
    },
  });

  const injectionResult = await LeadExportService.exportLeadsCsv(adminCtx, { search: injectionEmail });
  const parsedInjection = parseCsv(injectionResult.csv);
  const formulaRow = parsedInjection.rows.find((r) => r["Email"] === injectionEmail);

  assert.ok(formulaRow, "Formula injection lead should be exported");
  const nameVal = formulaRow["Lead Name"];
  const companyVal = formulaRow["Company"];

  assert.ok(nameVal?.startsWith("'="), `Name should be escaped with leading quote: got "${nameVal}"`);
  assert.ok(companyVal?.startsWith("'+"), `Company should be escaped with leading quote: got "${companyVal}"`);

  // Cleanup formula lead
  await prisma.lead.deleteMany({
    where: { companyId: acmeAdmin.companyId, email: injectionEmail },
  });

  // 4. Soft-deleted leads must never appear in export
  console.log("  → [Soft-Deleted Exclusion] Soft-deleted leads must not appear in export...");
  const softDeletedEmail = `softdel-${Date.now()}@example.com`;
  const softDeletedLead = await prisma.lead.create({
    data: {
      companyId: acmeAdmin.companyId,
      name: "Deleted Lead",
      email: softDeletedEmail,
      deletedAt: new Date(),
    },
  });

  const exportAfterDelete = await LeadExportService.exportLeadsCsv(adminCtx, { search: softDeletedEmail });
  const parsedAfterDelete = parseCsv(exportAfterDelete.csv);
  const foundDeleted = parsedAfterDelete.rows.find((r) => r["Email"] === softDeletedEmail);
  assert.equal(foundDeleted, undefined, "Soft-deleted lead should not appear in export");

  // Cleanup
  await prisma.lead.delete({ where: { id: softDeletedLead.id } });

  console.log("  ✔ All Lead Export Security & Data-Scope Tests Passed!");
}

if (require.main === module) {
  runLeadExportSecurityTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
