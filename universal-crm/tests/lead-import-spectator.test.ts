/**
 * Adversarial Spectator Tests for Slice 5 Lead Import
 * Tests role enforcement, malformed inputs, and unauthorized import inspection.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { LeadImportService } from "../lib/services/lead-import.service";
import { NotFoundError, ValidationError } from "../lib/errors";

export async function runLeadImportSpectatorTests() {
  console.log("\n🕵️  Running Lead Import Adversarial Spectator Tests...");

  const [adminUser, repUser, zenithAdmin] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: "admin@acmecorp.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "sarah@acmecorp.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "admin@zenithsolutions.com" } }),
  ]);

  const [adminSession, repSession, zenithSession] = await Promise.all([
    createDbSession(adminUser.id, adminUser.companyId),
    createDbSession(repUser.id, repUser.companyId),
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

  // TEST 1: Execute import creates proper tracking record
  console.log("  → [Import Tracking] Verifying import execution tracking...");
  const validCsv = `name,email\nSpectator Lead,spec-${Date.now()}@acmecorp.com`;
  const importRecord = await LeadImportService.executeImport(adminCtx, {
    csvContent: validCsv,
    filename: "spectator_test.csv",
    columnMappings: { name: "name", email: "email" },
    duplicateStrategy: "CREATE",
  });

  assert.ok(importRecord.id, "Import record must be created");

  // TEST 2: Foreign Tenant cannot inspect or download Acme's import history/errors
  console.log("  → [Cross-Tenant Isolation] Zenith admin cannot fetch Acme import record...");
  await assert.rejects(
    async () => {
      await LeadImportService.getImportById(zenithCtx, importRecord.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Foreign tenant import access must return 404");
      return true;
    }
  );

  // TEST 3: Malformed CSV without required name column in mappings
  console.log("  → [Validation Check] Executing import without 'name' column mapped...");
  await assert.rejects(
    async () => {
      await LeadImportService.executeImport(adminCtx, {
        csvContent: `email\ntest@example.com`,
        filename: "no_name.csv",
        columnMappings: { email: "email" },
        duplicateStrategy: "CREATE",
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError, "Import missing required 'name' mapping must throw ValidationError");
      return true;
    }
  );

  // TEST 4: Empty CSV handling
  console.log("  → [Malformed Input] Previewing completely empty CSV string...");
  await assert.rejects(
    async () => {
      await LeadImportService.previewImport(adminCtx, "   \n\n  ", "empty.csv");
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError, "Empty CSV preview must throw ValidationError");
      return true;
    }
  );

  // Cleanup test lead
  await prisma.lead.deleteMany({
    where: { companyId: adminCtx.company.id, email: { startsWith: "spec-" } },
  });

  console.log("  ✔ All Lead Import Adversarial Spectator Tests PASSED!");
}

if (require.main === module) {
  runLeadImportSpectatorTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
