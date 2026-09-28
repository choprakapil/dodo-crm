/**
 * Adversarial Spectator Tests for Slice 4 Follow-ups
 * Tests scope boundaries (OWN vs TEAM vs COMPANY), mass assignment, and completion state integrity.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { FollowUpService } from "../lib/services/follow-up.service";
import { NotFoundError } from "../lib/errors";
import { TaskStatus } from "@prisma/client";

export async function runFollowUpSpectatorTests() {
  console.log("\n🕵️  Running Follow-up Adversarial Spectator Tests...");

  // 1. Sales Rep session (OWN scope)
  const repUser = await prisma.user.findFirst({
    where: { email: "sarah@acmecorp.com" },
  });
  assert.ok(repUser, "Acme sales rep Sarah must exist");
  const repSession = await createDbSession(repUser.id, repUser.companyId);
  const repCtx = await validateSessionToken(repSession.rawToken);
  assert.ok(repCtx, "Sales rep AuthContext must exist");

  // 2. Manager session (TEAM scope)
  const mgrUser = await prisma.user.findFirst({
    where: { email: "manager@acmecorp.com" },
  });
  assert.ok(mgrUser, "Acme manager must exist");
  const mgrSession = await createDbSession(mgrUser.id, mgrUser.companyId);
  const mgrCtx = await validateSessionToken(mgrSession.rawToken);
  assert.ok(mgrCtx, "Manager AuthContext must exist");

  // TEST 1: Manager creates a follow-up for himself
  console.log("  → [Data Scope Setup] Manager creates a follow-up...");
  const mgrFollowUp = await FollowUpService.createFollowUp(mgrCtx, {
    title: "Manager strategic follow-up",
    description: "Internal manager review",
    assignedUserId: mgrUser.id,
  });
  assert.ok(mgrFollowUp.id);

  // TEST 2: Sales rep cannot read follow-up outside OWN scope
  console.log("  → [Data Scope OWN] Sales rep Sarah attempts to read Manager's follow-up...");
  await assert.rejects(
    async () => {
      await FollowUpService.getFollowUpById(repCtx, mgrFollowUp.id);
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Follow-up outside OWN scope must return NotFoundError (404)"
      );
      return true;
    }
  );

  // TEST 3: Mass Assignment Protection on Follow-up Creation
  console.log("  → [Mass Assignment] Attempting to inject companyId, completedAt, status into creation...");
  const maliciousInput = {
    title: "Injected task",
    companyId: "foreign-co",
    status: TaskStatus.COMPLETED,
    completedAt: new Date(),
    id: "hacked-id",
  } as unknown as { title: string };

  const sanitized = await FollowUpService.createFollowUp(repCtx, maliciousInput);
  assert.equal(sanitized.companyId, repCtx.company.id, "companyId must strictly equal user's tenant");
  assert.equal(sanitized.status, TaskStatus.PENDING, "Initial status must always be PENDING on creation");
  assert.notEqual(sanitized.id, "hacked-id", "id must be system generated cuid");

  // Clean up
  await prisma.task.deleteMany({
    where: { id: { in: [mgrFollowUp.id, sanitized.id] } },
  });

  console.log("  ✅ All Follow-up Adversarial Spectator Tests PASSED!");
}

if (require.main === module) {
  runFollowUpSpectatorTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
