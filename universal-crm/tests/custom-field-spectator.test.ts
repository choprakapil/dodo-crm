/**
 * Adversarial Spectator Tests for Slice 5 Custom Fields
 * Tests authorization violations, cross-scope tampering, and injection protection.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { CustomFieldService } from "../lib/services/custom-field.service";
import { LeadService } from "../lib/services/lead.service";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";

export async function runCustomFieldSpectatorTests() {
  console.log("\n🕵️  Running Custom Field Adversarial Spectator Tests...");

  // 1. Fetch users
  const [adminUser, repUser] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: { email: "admin@acmecorp.com" },
    }),
    prisma.user.findFirstOrThrow({
      where: { email: "sarah@acmecorp.com" },
    }),
  ]);

  const adminSession = await createDbSession(adminUser.id, adminUser.companyId);
  const repSession = await createDbSession(repUser.id, repUser.companyId);

  const adminCtx = await validateSessionToken(adminSession.rawToken);
  const repCtx = await validateSessionToken(repSession.rawToken);

  assert.ok(adminCtx, "Admin AuthContext must exist");
  assert.ok(repCtx, "Rep AuthContext must exist");

  // TEST 1: Sales Rep cannot create new custom fields (lacks custom_fields:create / settings:manage)
  console.log("  → [RBAC Violation] Sales Rep attempts to create custom field definition...");
  await assert.rejects(
    async () => {
      await CustomFieldService.createCustomField(repCtx, {
        entityType: "LEAD",
        label: "Hacker Field",
        key: "hacker_field",
        fieldType: "TEXT",
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError, "Rep must be forbidden from defining custom fields");
      return true;
    }
  );

  // TEST 2: Sales Rep cannot delete or modify custom field schema
  console.log("  → [RBAC Violation] Sales Rep attempts to delete existing custom field definition...");
  const testField = await CustomFieldService.createCustomField(adminCtx, {
    entityType: "LEAD",
    label: "Spectator Test Field",
    key: `spec_test_${Date.now()}`,
    fieldType: "TEXT",
  });

  await assert.rejects(
    async () => {
      await CustomFieldService.deleteCustomField(repCtx, testField.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError, "Rep must be forbidden from deleting custom fields");
      return true;
    }
  );

  // TEST 3: Sales Rep cannot save custom field values on an unowned lead via LeadService
  console.log("  → [Data Scope Violation] Sales Rep attempts to set custom field value on unowned lead...");
  const unownedLead = await prisma.lead.findFirst({
    where: {
      companyId: repCtx.company.id,
      assignedUserId: { not: repUser.id },
      deletedAt: null,
    },
  });

  if (unownedLead) {
    await assert.rejects(
      async () => {
        await LeadService.updateLead(repCtx, unownedLead.id, {
          customFields: {
            [testField.id]: "Injected Value",
          },
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError, "Accessing unowned lead custom fields must 404");
        return true;
      }
    );
  }

  // TEST 4: Type validation tampering (e.g. passing text to NUMBER or non-whitelisted option to SELECT)
  console.log("  → [Type Tampering] Passing invalid text to NUMBER custom field...");
  const numberField = await CustomFieldService.createCustomField(adminCtx, {
    entityType: "LEAD",
    label: "Score",
    key: `score_${Date.now()}`,
    fieldType: "NUMBER",
  });

  // Find a lead owned by rep
  const ownLead = await prisma.lead.findFirst({
    where: {
      companyId: repCtx.company.id,
      assignedUserId: repUser.id,
      deletedAt: null,
    },
  });
  assert.ok(ownLead, "Sarah must have an owned lead");

  await assert.rejects(
    async () => {
      await CustomFieldService.saveLeadCustomFields(prisma, repCtx, ownLead.id, {
        [numberField.id]: "not-a-number",
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError, "Non-number value must fail validation");
      return true;
    }
  );

  // Clean up test fields
  await CustomFieldService.deleteCustomField(adminCtx, testField.id);
  await CustomFieldService.deleteCustomField(adminCtx, numberField.id);

  console.log("  ✔ All Custom Field Adversarial Spectator Tests PASSED!");
}

if (require.main === module) {
  runCustomFieldSpectatorTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
