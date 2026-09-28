/**
 * Integration Tests for Slice 4 — Activity Service
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { ActivityService } from "../lib/services/activity.service";
import { ActivityType } from "@prisma/client";

export async function runActivityIntegrationTests() {
  console.log("\n🧪 Running Activity Integration Tests...");

  // 1. Setup authenticated session for Acme Corp Admin
  const acmeUser = await prisma.user.findFirst({
    where: { email: "admin@acmecorp.com" },
  });
  assert.ok(acmeUser, "Acme admin must exist");
  const acmeSession = await createDbSession(acmeUser.id, acmeUser.companyId);
  const acmeCtx = await validateSessionToken(acmeSession.rawToken);
  assert.ok(acmeCtx, "Acme AuthContext must exist");

  // Fetch an active Acme lead
  const acmeLead = await prisma.lead.findFirst({
    where: { companyId: acmeCtx.company.id, deletedAt: null },
  });
  assert.ok(acmeLead, "Acme lead must exist");

  // TEST 1: Create Call Activity
  console.log("  → [Create Activity] Creating Call activity for lead...");
  const callActivity = await ActivityService.createActivity(acmeCtx, acmeLead.id, {
    type: "CALL",
    subject: "Pricing Review",
    description: "Spoke with prospect about custom enterprise volume tiers.",
    metadata: { duration: 15, outcome: "Interested" },
  });

  assert.ok(callActivity.id);
  assert.equal(callActivity.companyId, acmeCtx.company.id);
  assert.equal(callActivity.leadId, acmeLead.id);
  assert.equal(callActivity.type, ActivityType.CALL);
  assert.ok(callActivity.description.includes("Pricing Review"));

  // Verify AuditLog entry was written
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      companyId: acmeCtx.company.id,
      entityId: callActivity.id,
      action: "ACTIVITY_CREATED",
    },
  });
  assert.ok(auditLog, "Audit log must be recorded for activity creation");

  // TEST 2: List Activities for Lead
  console.log("  → [List Activities] Listing activities for lead...");
  const list = await ActivityService.listActivitiesForLead(acmeCtx, acmeLead.id, {
    page: 1,
    limit: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  assert.ok(list.data.length > 0);
  const found = (list.data as Array<{ id: string }>).find((a) => a.id === callActivity.id);
  assert.ok(found, "Newly created activity must appear in lead activities list");

  // TEST 3: Get Activity By ID
  console.log("  → [Get Activity] Fetching activity by ID...");
  const fetched = await ActivityService.getActivityById(acmeCtx, callActivity.id);
  assert.equal(fetched.id, callActivity.id);
  assert.equal(fetched.companyId, acmeCtx.company.id);

  // TEST 4: Update Activity
  console.log("  → [Update Activity] Updating activity description...");
  const updated = await ActivityService.updateActivity(acmeCtx, callActivity.id, {
    description: "Updated notes: Prospect agreed to annual contract.",
    metadata: { outcome: "AGREED" },
  });
  assert.equal(updated.description, "Updated notes: Prospect agreed to annual contract.");

  // TEST 5: Delete Activity
  console.log("  → [Delete Activity] Deleting activity...");
  const deleteRes = await ActivityService.deleteActivity(acmeCtx, callActivity.id);
  assert.equal(deleteRes.success, true);

  // Verify deletion from DB
  const deletedCheck = await prisma.activity.findUnique({
    where: { id: callActivity.id },
  });
  assert.equal(deletedCheck, null, "Activity must be removed from DB");

  console.log("  ✅ All Activity Integration Tests PASSED!");
}

if (require.main === module) {
  runActivityIntegrationTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
