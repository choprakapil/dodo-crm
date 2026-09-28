/**
 * Security & Adversarial Tests for Lead Import Engine
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { LeadImportService } from "../lib/services/lead-import.service";
import { createDbSession, validateSessionToken } from "../lib/auth/session";

export async function runLeadImportSecurityTests() {
  console.log("\n🔒 Running Lead Import Security & Tamper-Resistance Tests...");

  const [acmeAdmin, zenithAdmin] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: { email: "admin@acmecorp.com" },
    }),
    prisma.user.findFirstOrThrow({
      where: { email: "admin@zenithsolutions.com" },
    }),
  ]);

  const [acmeSession, zenithSession] = await Promise.all([
    createDbSession(acmeAdmin.id, acmeAdmin.companyId),
    createDbSession(zenithAdmin.id, zenithAdmin.companyId),
  ]);

  const [acmeCtx, zenithCtx] = await Promise.all([
    validateSessionToken(acmeSession.rawToken),
    validateSessionToken(zenithSession.rawToken),
  ]);

  assert.ok(acmeCtx);
  assert.ok(zenithCtx);

  // 1. Foreign tenant user & status injection in CSV
  console.log("  → [Foreign Reference Injection] Passing Zenith user/status to Acme import...");
  const foreignCsv = `name,email,status,assignedUser\nInjected Lead,injected@example.com,NonExistentOrZenithStatus,admin@zenithsolutions.com`;

  const runResult = await LeadImportService.executeImport(acmeCtx, {
    csvContent: foreignCsv,
    filename: "foreign_injection.csv",
    columnMappings: {
      name: "name",
      email: "email",
      status: "status",
      assignedUser: "assignedUser",
    },
    duplicateStrategy: "CREATE",
  });

  assert.equal(runResult.successfulRows, 1);
  const createdLead = await prisma.lead.findFirst({
    where: { companyId: acmeCtx.company.id, email: "injected@example.com" },
  });

  assert.ok(createdLead);
  // AssignedUser must NOT be set to zenithAdmin.id
  assert.notEqual(createdLead.assignedUserId, zenithAdmin.id);
  assert.equal(createdLead.assignedUserId, null, "Foreign user ID must not be assigned");

  // 2. CSV companyId column spoofing
  console.log("  → [Tenant Spoofing] CSV containing companyId column with Zenith's ID...");
  const spoofCsv = `name,email,companyId\nSpoofed Lead,spoofed@example.com,${zenithAdmin.companyId}`;

  await LeadImportService.executeImport(acmeCtx, {
    csvContent: spoofCsv,
    filename: "spoofed_company.csv",
    columnMappings: {
      name: "name",
      email: "email",
    },
    duplicateStrategy: "CREATE",
  });

  const spoofedLead = await prisma.lead.findFirst({
    where: { email: "spoofed@example.com" },
  });
  assert.ok(spoofedLead);
  // Strictly belongs to Acme, not Zenith
  assert.equal(spoofedLead.companyId, acmeCtx.company.id);
  assert.notEqual(spoofedLead.companyId, zenithAdmin.companyId);

  // 3. Protected field tampering in UPDATE mode
  console.log("  → [Protected Fields] Attempting to tamper with lead id and createdAt via UPDATE...");
  const existingLead = await prisma.lead.findFirstOrThrow({
    where: { companyId: acmeCtx.company.id, deletedAt: null },
  });
  const originalCreatedAt = existingLead.createdAt;

  const tamperCsv = `name,email,id,createdAt\nTampered Name,${existingLead.email},random-id,1999-01-01T00:00:00.000Z`;

  await LeadImportService.executeImport(acmeCtx, {
    csvContent: tamperCsv,
    filename: "tamper_update.csv",
    columnMappings: {
      name: "name",
      email: "email",
    },
    duplicateStrategy: "UPDATE",
  });

  const reloadedLead = await prisma.lead.findUniqueOrThrow({
    where: { id: existingLead.id },
  });
  assert.equal(reloadedLead.id, existingLead.id, "ID must not be modified by import");
  assert.equal(reloadedLead.createdAt.getTime(), originalCreatedAt.getTime(), "createdAt must not be modified");

  // 4. Missing required name records error without crashing batch
  console.log("  → [Error Resilience] Row with missing name is recorded as failed...");
  const badCsv = `name,email\n,bademail@example.com\nValid Lead,valid@example.com`;
  const badResult = await LeadImportService.executeImport(acmeCtx, {
    csvContent: badCsv,
    filename: "partial_errors.csv",
    columnMappings: {
      name: "name",
      email: "email",
    },
    duplicateStrategy: "CREATE",
  });

  assert.equal(badResult.totalRows, 2);
  assert.equal(badResult.successfulRows, 1);
  assert.equal(badResult.failedRows, 1);
  assert.equal(badResult.status, "COMPLETED_WITH_ERRORS");

  // Cleanup
  await prisma.lead.deleteMany({
    where: { email: { in: ["injected@example.com", "spoofed@example.com", "valid@example.com"] } },
  });
  await prisma.leadImport.deleteMany({
    where: { id: { in: [runResult.id, badResult.id] } },
  });

  console.log("  ✅ Lead Import Security Tests PASSED!");
}

if (require.main === module) {
  runLeadImportSecurityTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
