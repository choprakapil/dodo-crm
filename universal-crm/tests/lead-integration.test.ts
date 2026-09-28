/**
 * Integration Tests for Slice 3 — Lead Management Core
 * Tests CRUD operations, history recording, activity timeline, search, filtering, and soft delete.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { LeadService } from "../lib/services/lead.service";
import { LeadPriority, ActivityType } from "@prisma/client";
import { NotFoundError } from "../lib/errors";

interface TestLead {
  id: string;
  name: string;
  statusId: string | null;
}

export async function runLeadIntegrationTests() {
  console.log("\n🧪 Running Lead Integration Tests: CRUD, History, Search & Lifecycle...");

  // 1. Setup authenticated session for Acme Corp Admin
  const user = await prisma.user.findFirst({
    where: { email: "admin@acmecorp.com" },
  });
  assert.ok(user, "Acme admin user must exist");

  const session = await createDbSession(user.id, user.companyId);
  const ctx = await validateSessionToken(session.rawToken);
  assert.ok(ctx, "AuthContext must be generated");

  // 2. Fetch config options
  console.log("  → Checking LeadService.getLeadConfig...");
  const config = await LeadService.getLeadConfig(ctx);
  assert.ok(config.statuses.length > 0, "Company must have statuses");
  assert.ok(config.sources.length > 0, "Company must have sources");
  assert.ok(config.users.length > 0, "Company must have users");

  const defaultStatus = config.statuses.find((s: { isDefault?: boolean; id: string }) => s.isDefault) || config.statuses[0];
  const activeSource = config.sources[0];
  const secondUser = config.users.find((u: { id: string }) => u.id !== user.id) || config.users[0];

  // 3. Test Lead Creation with History & Activity
  console.log("  → Testing LeadService.createLead...");
  const uniqueName = `Test Lead ${Date.now()}`;
  const createdLead = await LeadService.createLead(ctx, {
    name: uniqueName,
    email: "test.lead@enterprise.com",
    phone: "+1 555-0199",
    company: "Enterprise Global",
    amount: 125000,
    priority: LeadPriority.HIGH,
    sourceId: activeSource.id,
    assignedUserId: user.id,
  });

  assert.ok(createdLead.id, "Lead should be created with an ID");
  assert.equal(createdLead.name, uniqueName);
  assert.equal(createdLead.companyId, ctx.company.id, "Lead must be bound to authenticated company");
  assert.equal(createdLead.statusId, defaultStatus.id, "Lead must have default status");
  assert.equal(createdLead.sourceId, activeSource.id);
  assert.equal(createdLead.assignedUserId, user.id);
  assert.equal(Number(createdLead.amount), 125000);

  // Verify initial status history was created
  const initialStatusHistory = await prisma.leadStatusHistory.findFirst({
    where: { leadId: createdLead.id },
  });
  assert.ok(initialStatusHistory, "Initial LeadStatusHistory must be recorded");
  assert.equal(initialStatusHistory.fromStatusId, null);
  assert.equal(initialStatusHistory.toStatusId, defaultStatus.id);
  assert.equal(initialStatusHistory.changedById, user.id);

  // Verify initial assignment history was recorded
  const initialAssignHistory = await prisma.leadAssignmentHistory.findFirst({
    where: { leadId: createdLead.id },
  });
  assert.ok(initialAssignHistory, "Initial LeadAssignmentHistory must be recorded");
  assert.equal(initialAssignHistory.toUserId, user.id);
  assert.equal(initialAssignHistory.assignedById, user.id);

  // Verify activity was recorded
  const createActivity = await prisma.activity.findFirst({
    where: { leadId: createdLead.id, type: ActivityType.LEAD_CREATED },
  });
  assert.ok(createActivity, "LEAD_CREATED Activity must be recorded");

  // 4. Test Lead Retrieval (getLeadById)
  console.log("  → Testing LeadService.getLeadById...");
  const fetchedLead = await LeadService.getLeadById(ctx, createdLead.id);
  assert.equal(fetchedLead.id, createdLead.id);
  assert.ok(fetchedLead.status, "Status relation must be hydrated");
  assert.ok(fetchedLead.source, "Source relation must be hydrated");
  assert.ok(fetchedLead.assignedUser, "AssignedUser relation must be hydrated");
  assert.ok(fetchedLead.statusHistories.length >= 1, "Status histories must be included");
  assert.ok(fetchedLead.assignmentHistories.length >= 1, "Assignment histories must be included");
  assert.ok(fetchedLead.activities.length >= 1, "Activities must be included");

  // 5. Test Lead List, Search, and Filters
  console.log("  → Testing LeadService.listLeads with search and pagination...");
  const searchResults = await LeadService.listLeads(ctx, {
    page: 1,
    limit: 10,
    search: uniqueName,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  assert.equal(searchResults.pagination.total >= 1, true, "Search must return created lead");
  const firstFound = searchResults.data[0] as { id: string; name: string };
  assert.equal(firstFound.id, createdLead.id);
  assert.equal(firstFound.name, uniqueName);

  // Test filter by status
  const filterResults = await LeadService.listLeads(ctx, {
    page: 1,
    limit: 10,
    statusId: defaultStatus.id,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  assert.ok((filterResults.data as unknown as TestLead[]).every((l) => l.statusId === defaultStatus.id));

  // 6. Test Lead Update with Status Transition & Reassignment
  console.log("  → Testing LeadService.updateLead (Status & Assignee transition)...");
  const nextStatus = config.statuses.find((s: { id: string }) => s.id !== defaultStatus.id) || config.statuses[1];
  assert.ok(nextStatus, "Second status must exist for transition test");

  const updatedLead = await LeadService.updateLead(ctx, createdLead.id, {
    name: `${uniqueName} (Updated)`,
    amount: 150000,
    statusId: nextStatus.id,
    assignedUserId: secondUser.id,
  });

  assert.equal(updatedLead.name, `${uniqueName} (Updated)`);
  assert.equal(updatedLead.statusId, nextStatus.id);
  assert.equal(updatedLead.assignedUserId, secondUser.id);
  assert.equal(Number(updatedLead.amount), 150000);

  // Verify transition status history
  const transitionStatusHistory = await prisma.leadStatusHistory.findFirst({
    where: { leadId: createdLead.id, toStatusId: nextStatus.id },
  });
  assert.ok(transitionStatusHistory, "Transition LeadStatusHistory must be recorded");
  assert.equal(transitionStatusHistory.fromStatusId, defaultStatus.id);

  // Verify reassignment history
  const reassignmentHistory = await prisma.leadAssignmentHistory.findFirst({
    where: { leadId: createdLead.id, toUserId: secondUser.id },
  });
  assert.ok(reassignmentHistory, "Reassignment LeadAssignmentHistory must be recorded");
  assert.equal(reassignmentHistory.fromUserId, user.id);

  // Verify activity entries
  const statusActivity = await prisma.activity.findFirst({
    where: { leadId: createdLead.id, type: ActivityType.STATUS_CHANGED },
  });
  assert.ok(statusActivity, "STATUS_CHANGED activity must be created");

  const reassignActivity = await prisma.activity.findFirst({
    where: { leadId: createdLead.id, type: ActivityType.REASSIGNED },
  });
  assert.ok(reassignActivity, "REASSIGNED activity must be created");

  // 7. Test Soft Delete
  console.log("  → Testing LeadService.deleteLead (Soft delete)...");
  const deleteResult = await LeadService.deleteLead(ctx, createdLead.id);
  assert.equal(deleteResult.success, true);

  // Direct DB check: deletedAt is set
  const dbLead = await prisma.lead.findUnique({
    where: { id: createdLead.id },
  });
  assert.ok(dbLead, "Lead record must still physically exist in DB");
  assert.ok(dbLead.deletedAt !== null, "deletedAt timestamp must be populated");

  // LeadService.getLeadById must throw NotFoundError for soft-deleted lead
  await assert.rejects(
    async () => {
      await LeadService.getLeadById(ctx, createdLead.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Accessing soft-deleted lead must return NotFoundError");
      return true;
    }
  );

  // LeadService.listLeads must NOT include soft-deleted lead
  const listAfterDelete = await LeadService.listLeads(ctx, {
    page: 1,
    limit: 10,
    search: uniqueName,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  assert.equal(
    (listAfterDelete.data as unknown as TestLead[]).some((l) => l.id === createdLead.id),
    false,
    "Soft-deleted lead must NOT appear in normal listing"
  );

  console.log("  ✔ All Lead Integration Tests passed successfully!");
}

if (require.main === module) {
  runLeadIntegrationTests()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
