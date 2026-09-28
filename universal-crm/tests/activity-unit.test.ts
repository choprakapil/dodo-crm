/**
 * Unit Tests for Slice 4 — Activities & Follow-ups Validation
 */

import assert from "node:assert/strict";
import {
  activityCreateSchema,
  activityUpdateSchema,
  activityListQuerySchema,
} from "../lib/validations/activity";
import {
  followUpCreateSchema,
  followUpUpdateSchema,
  followUpListQuerySchema,
} from "../lib/validations/follow-up";
import { TaskPriority, TaskStatus } from "@prisma/client";

export async function runActivityUnitTests() {
  console.log("\n🧪 Running Activity & Follow-up Unit Tests (Validations & Normalization)...");

  // 1. Valid activity creation
  console.log("  → [Activity] Valid Call activity schema validation...");
  const validCall = activityCreateSchema.parse({
    type: "CALL",
    subject: "Discovery Call",
    description: "Discussed requirements for multi-tenant CRM migration.",
    metadata: { durationMinutes: 25, outcome: "POSITIVE" },
  });
  assert.equal(validCall.type, "CALL");
  assert.equal(validCall.subject, "Discovery Call");
  assert.equal(validCall.description, "Discussed requirements for multi-tenant CRM migration.");
  assert.equal((validCall.metadata as Record<string, unknown>).durationMinutes, 25);

  // 2. Reject missing activity description
  console.log("  → [Activity] Rejecting empty description...");
  assert.throws(
    () => {
      activityCreateSchema.parse({
        type: "NOTE",
        description: "   ",
      });
    },
    /Description is required/,
    "Empty description must fail validation"
  );

  // 3. Reject invalid activity type
  console.log("  → [Activity] Rejecting invalid activity type...");
  assert.throws(
    () => {
      activityCreateSchema.parse({
        type: "INVALID_TYPE",
        description: "Test description",
      });
    },
    /Invalid option|invalid_value|Invalid enum value/,
    "Invalid activity type must fail validation"
  );

  // 4. Test trim and sanitize
  console.log("  → [Activity] Testing string trimming...");
  const trimmed = activityCreateSchema.parse({
    type: "MEETING",
    subject: "   Q3 Strategy Session   ",
    description: "  Discussed roadmap.  ",
  });
  assert.equal(trimmed.subject, "Q3 Strategy Session");
  assert.equal(trimmed.description, "Discussed roadmap.");

  // 4b. Activity update and list query schemas
  console.log("  → [Activity] Testing update and query schemas...");
  const updateParsed = activityUpdateSchema.parse({ description: "Updated text" });
  assert.equal(updateParsed.description, "Updated text");
  const queryParsed = activityListQuerySchema.parse({});
  assert.equal(queryParsed.page, 1);
  assert.equal(queryParsed.limit, 20);

  // 5. Valid Follow-up creation
  console.log("  → [Follow-up] Valid follow-up creation...");
  const validFollowUp = followUpCreateSchema.parse({
    leadId: "lead_cuid_123",
    title: "Send pricing proposal",
    description: "Include volume discount tiers",
    dueAt: "2026-10-01T15:00:00Z",
    priority: TaskPriority.HIGH,
    assignedUserId: "user_cuid_456",
  });
  assert.equal(validFollowUp.title, "Send pricing proposal");
  assert.equal(validFollowUp.priority, TaskPriority.HIGH);
  assert.ok(validFollowUp.dueAt instanceof Date);

  // 6. Reject invalid follow-up due date format
  console.log("  → [Follow-up] Rejecting invalid date format...");
  assert.throws(
    () => {
      followUpCreateSchema.parse({
        title: "Test Task",
        dueAt: "not-a-real-date",
      });
    },
    /Invalid due date/,
    "Invalid date string must throw error"
  );

  // 7. Follow-up query defaults
  console.log("  → [Follow-up] Query schema defaults...");
  const query = followUpListQuerySchema.parse({});
  assert.equal(query.page, 1);
  assert.equal(query.limit, 20);
  assert.equal(query.dueFilter, "all");
  assert.equal(query.sortBy, "dueAt");
  assert.equal(query.sortOrder, "asc");

  // 8. Follow-up update status transition
  console.log("  → [Follow-up] Status update validation...");
  const update = followUpUpdateSchema.parse({
    status: TaskStatus.COMPLETED,
  });
  assert.equal(update.status, TaskStatus.COMPLETED);

  console.log("  ✅ All Activity & Follow-up Unit Tests PASSED!");
}

if (require.main === module) {
  runActivityUnitTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
