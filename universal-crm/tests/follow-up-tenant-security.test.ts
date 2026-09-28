/**
 * Tenant Security & IDOR Tests for Slice 4 Follow-ups
 * Tests cross-tenant isolation and foreign injection attacks between Acme Corp and Zenith Solutions.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { FollowUpService } from "../lib/services/follow-up.service";
import { NotFoundError, ValidationError } from "../lib/errors";

export async function runFollowUpTenantSecurityTests() {
  console.log("\n🛡️  Running Follow-up Tenant Security & IDOR Tests...");

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

  // 3. Create a follow-up in Zenith Solutions
  const zenithLead = await prisma.lead.findFirst({
    where: { companyId: zenithCtx.company.id, deletedAt: null },
  });
  assert.ok(zenithLead, "Zenith lead must exist");

  const zenithFollowUp = await FollowUpService.createFollowUp(zenithCtx, {
    leadId: zenithLead.id,
    title: "Zenith Confidential Follow-up",
    description: "Follow up on enterprise security audit",
  });

  // TEST 1: Cross-Tenant Follow-up Read IDOR
  console.log("  → [IDOR Read] Acme user attempts to read Zenith follow-up...");
  await assert.rejects(
    async () => {
      await FollowUpService.getFollowUpById(acmeCtx, zenithFollowUp.id);
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Reading foreign follow-up must throw NotFoundError (404)"
      );
      return true;
    }
  );

  // TEST 2: Foreign Lead ID Injection on Follow-up Creation
  console.log("  → [Foreign Lead Injection] Acme user attempts to create follow-up linking Zenith lead...");
  await assert.rejects(
    async () => {
      await FollowUpService.createFollowUp(acmeCtx, {
        leadId: zenithLead.id,
        title: "Malicious cross-tenant task",
      });
    },
    (err: unknown) => {
      assert.ok(
        err instanceof ValidationError,
        "Creating follow-up with foreign leadId must fail with ValidationError"
      );
      return true;
    }
  );

  // TEST 3: Foreign Assigned User ID Injection
  console.log("  → [Foreign User Injection] Acme user attempts to assign follow-up to Zenith user...");
  await assert.rejects(
    async () => {
      await FollowUpService.createFollowUp(acmeCtx, {
        title: "Cross-tenant assigned task",
        assignedUserId: zenithUser.id,
      });
    },
    (err: unknown) => {
      assert.ok(
        err instanceof ValidationError,
        "Assigning follow-up to foreign user must fail with ValidationError"
      );
      return true;
    }
  );

  // TEST 4: Cross-Tenant Follow-up Update IDOR
  console.log("  → [IDOR Update] Acme user attempts to update Zenith follow-up...");
  await assert.rejects(
    async () => {
      await FollowUpService.updateFollowUp(acmeCtx, zenithFollowUp.id, {
        title: "Tampered title by Acme",
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Updating foreign follow-up must throw NotFoundError");
      return true;
    }
  );

  // TEST 5: Cross-Tenant Complete IDOR
  console.log("  → [IDOR Complete] Acme user attempts to complete Zenith follow-up...");
  await assert.rejects(
    async () => {
      await FollowUpService.completeFollowUp(acmeCtx, zenithFollowUp.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Completing foreign follow-up must throw NotFoundError");
      return true;
    }
  );

  // TEST 6: Cross-Tenant Follow-up Delete IDOR
  console.log("  → [IDOR Delete] Acme user attempts to delete Zenith follow-up...");
  await assert.rejects(
    async () => {
      await FollowUpService.deleteFollowUp(acmeCtx, zenithFollowUp.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Deleting foreign follow-up must throw NotFoundError");
      return true;
    }
  );

  // Clean up Zenith follow-up
  await FollowUpService.deleteFollowUp(zenithCtx, zenithFollowUp.id);

  console.log("  ✅ All Follow-up Tenant Security Tests PASSED!");
}

if (require.main === module) {
  runFollowUpTenantSecurityTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
