/**
 * Unit Tests for Slice 4 — Follow-up Validation
 */

import assert from "node:assert/strict";
import {
  followUpCreateSchema,
  followUpUpdateSchema,
  followUpListQuerySchema,
} from "../lib/validations/follow-up";
import { TaskPriority, TaskStatus } from "@prisma/client";

export async function runFollowUpUnitTests() {
  console.log("\n🧪 Running Follow-up Unit Tests...");

  // 1. Valid Follow-up Creation Schema
  console.log("  → [Follow-up] Valid follow-up with complete inputs...");
  const valid = followUpCreateSchema.parse({
    leadId: "cl_lead_123",
    title: "Call CFO regarding budget sign-off",
    description: "Follow up after board meeting",
    dueAt: "2026-10-15T14:30:00.000Z",
    priority: TaskPriority.URGENT,
    assignedUserId: "cl_user_456",
    teamId: "cl_team_789",
  });
  assert.equal(valid.title, "Call CFO regarding budget sign-off");
  assert.equal(valid.priority, TaskPriority.URGENT);
  assert.equal(valid.assignedUserId, "cl_user_456");
  assert.ok(valid.dueAt instanceof Date);

  // 2. Reject missing title
  console.log("  → [Follow-up] Reject empty title...");
  assert.throws(
    () => {
      followUpCreateSchema.parse({
        title: "   ",
      });
    },
    /Title is required/,
    "Empty title must fail validation"
  );

  // 3. Optional dueAt parses null correctly
  console.log("  → [Follow-up] Null dueAt handling...");
  const noDue = followUpCreateSchema.parse({
    title: "Review pipeline",
    dueAt: null,
  });
  assert.equal(noDue.dueAt, null);

  // 4. Update Schema
  console.log("  → [Follow-up] Update schema status transitions...");
  const updateStatus = followUpUpdateSchema.parse({
    status: TaskStatus.COMPLETED,
  });
  assert.equal(updateStatus.status, TaskStatus.COMPLETED);

  // 5. Query Filters
  console.log("  → [Follow-up] Query filters parsing...");
  const query = followUpListQuerySchema.parse({
    page: "2",
    limit: "50",
    dueFilter: "overdue",
    priority: "HIGH",
  });
  assert.equal(query.page, 2);
  assert.equal(query.limit, 50);
  assert.equal(query.dueFilter, "overdue");
  assert.equal(query.priority, TaskPriority.HIGH);

  console.log("  ✅ All Follow-up Unit Tests PASSED!");
}

if (require.main === module) {
  runFollowUpUnitTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
