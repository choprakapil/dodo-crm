/**
 * Adversarial Spectator Tests for Slice 4 Activities
 * Tests scope violations, tampering, and unauthorized data leakage.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { ActivityService } from "../lib/services/activity.service";
import { NotFoundError } from "../lib/errors";

export async function runActivitySpectatorTests() {
  console.log("\n🕵️  Running Activity Adversarial Spectator Tests...");

  // 1. Sales Rep session (OWN data scope)
  const repUser = await prisma.user.findFirst({
    where: { email: "sarah@acmecorp.com" },
  });
  assert.ok(repUser, "Acme sales rep Sarah must exist");
  const repSession = await createDbSession(repUser.id, repUser.companyId);
  const repCtx = await validateSessionToken(repSession.rawToken);
  assert.ok(repCtx, "Sales rep AuthContext must exist");

  // 2. Find a lead assigned to Sarah
  const ownLead = await prisma.lead.findFirst({
    where: { companyId: repCtx.company.id, assignedUserId: repUser.id, deletedAt: null },
  });
  assert.ok(ownLead, "Sarah must have an assigned lead");

  // 3. Find a lead NOT assigned to Sarah (belongs to manager or unassigned)
  const unownedLead = await prisma.lead.findFirst({
    where: {
      companyId: repCtx.company.id,
      assignedUserId: { not: repUser.id },
      deletedAt: null,
    },
  });
  assert.ok(unownedLead, "Unowned lead must exist in company");

  // TEST 1: Sales Rep cannot log activity on lead they do not own
  console.log("  → [Data Scope OWN] Sales rep attempts to log activity on unowned lead...");
  await assert.rejects(
    async () => {
      await ActivityService.createActivity(repCtx, unownedLead.id, {
        type: "NOTE",
        description: "Spying on unowned lead",
      });
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Accessing lead outside OWN scope must return NotFoundError (404)"
      );
      return true;
    }
  );

  // TEST 2: Sales Rep successfully logs activity on their own lead
  console.log("  → [Data Scope OWN] Sales rep logs activity on their own lead...");
  const repActivity = await ActivityService.createActivity(repCtx, ownLead.id, {
    type: "CALL",
    subject: "Follow up call",
    description: "Discussed proposal terms with client.",
  });
  assert.ok(repActivity.id);
  assert.equal(repActivity.userId, repUser.id);

  // TEST 3: Mass Assignment Protection
  console.log("  → [Mass Assignment] Attempting to overwrite companyId or userId in create payload...");
  // Cast malicious object with forged companyId & userId
  const maliciousPayload = {
    type: "NOTE" as const,
    description: "Normal note text",
    companyId: "forged-company-id",
    userId: "forged-user-id",
    id: "forged-activity-id",
  } as unknown as { type: "NOTE"; description: string };

  const sanitizedActivity = await ActivityService.createActivity(repCtx, ownLead.id, maliciousPayload);
  assert.equal(sanitizedActivity.companyId, repCtx.company.id, "companyId must strictly equal authenticated tenant");
  assert.equal(sanitizedActivity.userId, repCtx.user.id, "userId must strictly equal authenticated user");
  assert.notEqual(sanitizedActivity.id, "forged-activity-id", "id must be server-generated cuid");

  // Cleanup test activities directly
  await prisma.activity.deleteMany({
    where: { id: { in: [repActivity.id, sanitizedActivity.id] } },
  });

  console.log("  ✅ All Activity Adversarial Spectator Tests PASSED!");
}

if (require.main === module) {
  runActivitySpectatorTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
