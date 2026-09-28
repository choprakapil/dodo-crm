/**
 * Integration Tests for Slice 4 — Follow-up Service
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { FollowUpService } from "../lib/services/follow-up.service";
import { TaskPriority, TaskStatus, ActivityType } from "@prisma/client";

export async function runFollowUpIntegrationTests() {
  console.log("\n🧪 Running Follow-up Integration Tests...");

  // 1. Acme Admin session
  const acmeUser = await prisma.user.findFirst({
    where: { email: "admin@acmecorp.com" },
  });
  assert.ok(acmeUser, "Acme admin must exist");
  const acmeSession = await createDbSession(acmeUser.id, acmeUser.companyId);
  const acmeCtx = await validateSessionToken(acmeSession.rawToken);
  assert.ok(acmeCtx, "Acme AuthContext must exist");

  // Fetch an active Acme lead without an existing active follow-up (respects Phase 7 invariant)
  let acmeLead = await prisma.lead.findFirst({
    where: {
      companyId: acmeCtx.company.id,
      deletedAt: null,
      tasks: {
        none: {
          type: "FOLLOW_UP",
          status: { in: ["PENDING", "OVERDUE"] },
        },
      },
    },
  });

  if (!acmeLead) {
    acmeLead = await prisma.lead.create({
      data: {
        companyId: acmeCtx.company.id,
        name: "Test Follow-up Lead",
      },
    });
  }
  assert.ok(acmeLead, "Acme lead must exist");

  // TEST 1: Create Follow-up
  console.log("  → [Create Follow-up] Scheduling follow-up for lead...");
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const followUp = await FollowUpService.createFollowUp(acmeCtx, {
    leadId: acmeLead.id,
    title: "Contract review call",
    description: "Check clause 4 on SLA terms with legal team",
    dueAt: tomorrow,
    priority: TaskPriority.HIGH,
    assignedUserId: acmeUser.id,
  });

  assert.ok(followUp.id);
  assert.equal(followUp.companyId, acmeCtx.company.id);
  assert.equal(followUp.leadId, acmeLead.id);
  assert.equal(followUp.status, TaskStatus.PENDING);
  assert.equal(followUp.priority, TaskPriority.HIGH);

  // Verify Activity entry created on lead timeline
  const timelineActivity = await prisma.activity.findFirst({
    where: {
      companyId: acmeCtx.company.id,
      leadId: acmeLead.id,
      type: ActivityType.TASK_CREATED,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(timelineActivity, "Timeline activity TASK_CREATED must be recorded");

  // Verify AuditLog
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      companyId: acmeCtx.company.id,
      entityId: followUp.id,
      action: "FOLLOWUP_CREATED",
    },
  });
  assert.ok(auditLog, "AuditLog must be recorded for follow-up creation");

  // TEST 2: List Follow-ups
  console.log("  → [List Follow-ups] Listing follow-ups with filters...");
  const list = await FollowUpService.listFollowUps(acmeCtx, {
    leadId: acmeLead.id,
    page: 1,
    limit: 20,
    dueFilter: "all",
    sortBy: "dueAt",
    sortOrder: "asc",
  });
  assert.ok(list.data.length > 0);
  const found = (list.data as Array<{ id: string }>).find((f) => f.id === followUp.id);
  assert.ok(found, "Created follow-up must be returned in list");

  // TEST 3: Get Follow-up By ID
  console.log("  → [Get Follow-up] Fetching follow-up by ID...");
  const fetched = await FollowUpService.getFollowUpById(acmeCtx, followUp.id);
  assert.equal(fetched.id, followUp.id);
  assert.equal(fetched.lead?.id, acmeLead.id);

  // TEST 4: Quick Complete Follow-up
  console.log("  → [Complete Follow-up] Completing follow-up...");
  const completed = await FollowUpService.completeFollowUp(acmeCtx, followUp.id);
  assert.equal(completed.status, TaskStatus.COMPLETED);
  assert.ok(completed.completedAt instanceof Date);
  assert.equal(completed.completedById, acmeUser.id);

  // Verify Activity entry for TASK_COMPLETED
  const completedActivity = await prisma.activity.findFirst({
    where: {
      companyId: acmeCtx.company.id,
      leadId: acmeLead.id,
      type: ActivityType.TASK_COMPLETED,
    },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(completedActivity, "Timeline activity TASK_COMPLETED must be recorded");

  // TEST 5: Delete Follow-up
  console.log("  → [Delete Follow-up] Deleting follow-up...");
  const deleteRes = await FollowUpService.deleteFollowUp(acmeCtx, followUp.id);
  assert.equal(deleteRes.success, true);

  const check = await prisma.task.findUnique({
    where: { id: followUp.id },
  });
  assert.equal(check, null, "Follow-up must be deleted from DB");

  console.log("  ✅ All Follow-up Integration Tests PASSED!");
}

if (require.main === module) {
  runFollowUpIntegrationTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
