/**
 * Tenant Security & IDOR Tests for Slice 4 Activities
 * Verifies strict tenant isolation between Acme Corp and Zenith Solutions.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { ActivityService } from "../lib/services/activity.service";
import { NotFoundError } from "../lib/errors";

export async function runActivityTenantSecurityTests() {
  console.log("\n🛡️  Running Activity Tenant Security & IDOR Tests...");

  // 1. Acme Admin session
  const acmeUser = await prisma.user.findFirst({
    where: { email: "admin@acmecorp.com" },
  });
  assert.ok(acmeUser, "Acme admin must exist");
  const acmeSession = await createDbSession(acmeUser.id, acmeUser.companyId);
  const acmeCtx = await validateSessionToken(acmeSession.rawToken);
  assert.ok(acmeCtx, "Acme AuthContext must exist");

  // 2. Zenith Admin session
  const zenithUser = await prisma.user.findFirst({
    where: { email: "admin@zenithsolutions.com" },
  });
  assert.ok(zenithUser, "Zenith admin must exist");
  const zenithSession = await createDbSession(zenithUser.id, zenithUser.companyId);
  const zenithCtx = await validateSessionToken(zenithSession.rawToken);
  assert.ok(zenithCtx, "Zenith AuthContext must exist");

  // 3. Create an activity in Zenith Solutions
  const zenithLead = await prisma.lead.findFirst({
    where: { companyId: zenithCtx.company.id, deletedAt: null },
  });
  assert.ok(zenithLead, "Zenith lead must exist");

  const zenithActivity = await ActivityService.createActivity(zenithCtx, zenithLead.id, {
    type: "NOTE",
    subject: "Confidential Zenith Plan",
    description: "Proprietary pricing model for Zenith enterprise client.",
  });

  // TEST 1: Cross-Tenant Activity Read IDOR
  console.log("  → [IDOR Read] Acme user attempts to read Zenith activity by ID...");
  await assert.rejects(
    async () => {
      await ActivityService.getActivityById(acmeCtx, zenithActivity.id);
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Reading foreign tenant activity must throw NotFoundError (404), never leak existence"
      );
      return true;
    }
  );

  // TEST 2: Cross-Tenant Activity Creation (Foreign Lead ID Injection)
  console.log("  → [Foreign Lead Injection] Acme user attempts to log activity on Zenith lead...");
  await assert.rejects(
    async () => {
      await ActivityService.createActivity(acmeCtx, zenithLead.id, {
        type: "CALL",
        description: "Malicious cross-tenant call log",
      });
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Creating activity on foreign lead must fail with NotFoundError"
      );
      return true;
    }
  );

  // TEST 3: Cross-Tenant Activity Update
  console.log("  → [IDOR Update] Acme user attempts to update Zenith activity...");
  await assert.rejects(
    async () => {
      await ActivityService.updateActivity(acmeCtx, zenithActivity.id, {
        description: "Tampered description from another tenant",
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Updating foreign activity must throw NotFoundError");
      return true;
    }
  );

  // TEST 4: Cross-Tenant Activity Delete
  console.log("  → [IDOR Delete] Acme user attempts to delete Zenith activity...");
  await assert.rejects(
    async () => {
      await ActivityService.deleteActivity(acmeCtx, zenithActivity.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Deleting foreign activity must throw NotFoundError");
      return true;
    }
  );

  // Clean up Zenith test activity
  await ActivityService.deleteActivity(zenithCtx, zenithActivity.id);

  console.log("  ✅ All Activity Tenant Security Tests PASSED!");
}

if (require.main === module) {
  runActivityTenantSecurityTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
