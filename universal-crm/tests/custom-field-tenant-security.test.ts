/**
 * Tenant Security & IDOR Tests for Custom Fields
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { Prisma } from "@prisma/client";
import { CustomFieldService } from "../lib/services/custom-field.service";
import { NotFoundError } from "../lib/errors";
import { createDbSession, validateSessionToken } from "../lib/auth/session";

export async function runCustomFieldTenantSecurityTests() {
  console.log("\n🔒 Running Custom Field Tenant Security & IDOR Tests...");

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

  // Clean up any stale field
  await prisma.customField.deleteMany({
    where: { companyId: zenithCtx.company.id, key: "zenith_secret_score" },
  });

  // Create Zenith confidential field
  const zenithField = await CustomFieldService.createCustomField(zenithCtx, {
    key: "zenith_secret_score",
    label: "Zenith Confidential Metric",
    fieldType: "NUMBER",
    required: false,
    active: true,
  });

  // 1. Cross-Tenant Read
  console.log("  → [IDOR Attack] Acme attempts to read Zenith custom field...");
  await assert.rejects(
    async () => {
      await CustomFieldService.getCustomFieldById(acmeCtx, zenithField.id);
    },
    NotFoundError,
    "Expected NotFoundError (404) when querying foreign custom field"
  );

  // 2. Cross-Tenant Update
  console.log("  → [IDOR Attack] Acme attempts to update Zenith custom field...");
  await assert.rejects(
    async () => {
      await CustomFieldService.updateCustomField(acmeCtx, zenithField.id, {
        label: "Tampered by Acme",
      });
    },
    NotFoundError,
    "Expected NotFoundError (404) when updating foreign custom field"
  );

  // 3. Cross-Tenant Delete
  console.log("  → [IDOR Attack] Acme attempts to delete Zenith custom field...");
  await assert.rejects(
    async () => {
      await CustomFieldService.deleteCustomField(acmeCtx, zenithField.id);
    },
    NotFoundError,
    "Expected NotFoundError (404) when deleting foreign custom field"
  );

  // 4. Foreign Custom Field Injection into Lead
  console.log("  → [Injection Attack] Acme lead attempting to assign Zenith customFieldId...");
  const acmeLead = await prisma.lead.findFirstOrThrow({
    where: { companyId: acmeCtx.company.id, deletedAt: null },
  });

  // Attempt to save Zenith field onto Acme lead
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await CustomFieldService.saveLeadCustomFields(tx, acmeCtx, acmeLead.id, {
      [zenithField.key]: 99999,
    });
  });

  // Value must NOT be saved because field is not in Acme tenant
  const foreignValue = await prisma.customFieldValue.findFirst({
    where: {
      companyId: acmeCtx.company.id,
      customFieldId: zenithField.id,
      entityId: acmeLead.id,
    },
  });
  assert.equal(foreignValue, null, "Foreign custom field value must not be saved");

  // Cleanup
  await prisma.customField.delete({ where: { id: zenithField.id } });

  console.log("  ✅ Custom Field Tenant Security Tests PASSED!");
}

if (require.main === module) {
  runCustomFieldTenantSecurityTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
