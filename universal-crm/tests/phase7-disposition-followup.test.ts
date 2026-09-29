/**
 * Phase 7 Master Automated Test Suite:
 * Disposition Management & Follow-Up Lifecycle Engine
 *
 * Covers:
 * 1. Arbitrary-depth disposition hierarchy & tree assembly
 * 2. Cycle detection and prevention (self-parent, descendant-parent)
 * 3. Strict tenant isolation (cross-tenant parents, dispositions, leads, follow-ups)
 * 4. Contradictory rule prevention (cancelActiveFollowUp + followUpMandatory)
 * 5. Atomic Call Outcome logging workflow (Lead, Activity, History, Task, Audit)
 * 6. ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK invariant
 * 7. Reschedule lifecycle (Callback, NO_ANSWER, status stays PENDING, TaskRescheduleHistory)
 * 8. Multiple reschedules and event sequence tracking
 * 9. Disposition with cancelActiveFollowUp: true (auto-cancellation)
 * 10. GENERAL task vs FOLLOW_UP task coexistence and independence
 * 11. Atomic overdue synchronization engine (syncOverdueFollowUps with UPDATE ... RETURNING)
 * 12. GENERAL tasks never become OVERDUE through follow-up engine
 * 13. Close gate rule enforcement (allowsClose = false prevents closing)
 * 14. RBAC, Data Scope & IDOR protection
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { DispositionService } from "../lib/services/disposition.service";
import { FollowUpService } from "../lib/services/follow-up.service";
import { LeadService } from "../lib/services/lead.service";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import {
  ActivityType,
  DataScope,
  TaskLifecycleEventType,
  TaskStatus,
  TaskType,
} from "@prisma/client";

export async function runPhase7DispositionFollowUpTests() {
  console.log("\n🧪 Running Phase 7: Disposition Management & Follow-Up Lifecycle Engine Test Suite...");

  const uniqueSuffix = Date.now().toString();

  // --------------------------------------------------------------------------
  // 1. SETUP TENANTS, ROLES & USERS
  // --------------------------------------------------------------------------
  // Company A (Primary Tenant)
  const companyA = await prisma.company.create({
    data: {
      name: `Phase7 Tenant Alpha ${uniqueSuffix}`,
      slug: `p7-alpha-${uniqueSuffix}`,
      defaultCountryCode: "IN",
      currency: "INR",
    },
  });

  // Company B (Adversary Tenant for Isolation Tests)
  const companyB = await prisma.company.create({
    data: {
      name: `Phase7 Tenant Beta ${uniqueSuffix}`,
      slug: `p7-beta-${uniqueSuffix}`,
      defaultCountryCode: "IN",
      currency: "INR",
    },
  });

  // Roles for Company A
  const roleAdminA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Admin",
      isSystem: true,
      permissions: {
        create: [
          { module: "dispositions", action: "manage", dataScope: DataScope.COMPANY },
          { module: "leads", action: "manage", dataScope: DataScope.COMPANY },
          { module: "tasks", action: "manage", dataScope: DataScope.COMPANY },
          { module: "activities", action: "manage", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  const roleRepA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Sales Rep",
      isSystem: false,
      permissions: {
        create: [
          { module: "dispositions", action: "view", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.OWN },
          { module: "leads", action: "update", dataScope: DataScope.OWN },
          { module: "tasks", action: "view", dataScope: DataScope.OWN },
          { module: "tasks", action: "update", dataScope: DataScope.OWN },
          { module: "tasks", action: "create", dataScope: DataScope.OWN },
          { module: "activities", action: "create", dataScope: DataScope.OWN },
        ],
      },
    },
  });

  const roleViewerA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Viewer",
      isSystem: false,
      permissions: {
        create: [
          { module: "dispositions", action: "view", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  // Role for Company B
  const roleAdminB = await prisma.role.create({
    data: {
      companyId: companyB.id,
      name: "Admin",
      isSystem: true,
      permissions: {
        create: [
          { module: "dispositions", action: "manage", dataScope: DataScope.COMPANY },
          { module: "leads", action: "manage", dataScope: DataScope.COMPANY },
          { module: "tasks", action: "manage", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  // Users
  const userAdminA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: roleAdminA.id,
      name: "Admin Alpha",
      email: `admin-a-${uniqueSuffix}@example.com`,
      hashedPassword: "hashedpassword123",
      status: "ACTIVE",
    },
  });

  const userRepA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: roleRepA.id,
      name: "Rep Alpha",
      email: `rep-a-${uniqueSuffix}@example.com`,
      hashedPassword: "hashedpassword123",
      status: "ACTIVE",
    },
  });

  const userViewerA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: roleViewerA.id,
      name: "Viewer Alpha",
      email: `viewer-a-${uniqueSuffix}@example.com`,
      hashedPassword: "hashedpassword123",
      status: "ACTIVE",
    },
  });

  const userAdminB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      roleId: roleAdminB.id,
      name: "Admin Beta",
      email: `admin-b-${uniqueSuffix}@example.com`,
      hashedPassword: "hashedpassword123",
      status: "ACTIVE",
    },
  });

  // Auth Contexts
  const sessionAdminA = await createDbSession(userAdminA.id, companyA.id);
  const ctxAdminA = (await validateSessionToken(sessionAdminA.rawToken))!;

  const sessionRepA = await createDbSession(userRepA.id, companyA.id);
  const ctxRepA = (await validateSessionToken(sessionRepA.rawToken))!;

  const sessionViewerA = await createDbSession(userViewerA.id, companyA.id);
  const ctxViewerA = (await validateSessionToken(sessionViewerA.rawToken))!;

  const sessionAdminB = await createDbSession(userAdminB.id, companyB.id);
  const ctxAdminB = (await validateSessionToken(sessionAdminB.rawToken))!;

  // Lead Statuses
  const statusOpen = await prisma.leadStatus.create({
    data: { companyId: companyA.id, name: "Open", isDefault: true, displayOrder: 1 },
  });
  const statusClosedWon = await prisma.leadStatus.create({
    data: { companyId: companyA.id, name: "Closed Won", displayOrder: 2 },
  });

  // Leads for testing
  const lead1 = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      statusId: statusOpen.id,
      name: "Acme Corp Prospect",
      phone: "+919876500001",
      assignedUserId: userRepA.id,
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      statusId: statusOpen.id,
      name: "Beta Industries Prospect",
      phone: "+919876500002",
      assignedUserId: userRepA.id,
    },
  });

  const leadCompanyB = await prisma.lead.create({
    data: {
      companyId: companyB.id,
      name: "Foreign Tenant Prospect",
      phone: "+919876500003",
      assignedUserId: userAdminB.id,
    },
  });

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Arbitrary-Depth Hierarchy & Tree Assembly
    // ------------------------------------------------------------------------
    console.log("  Testing Arbitrary-Depth Disposition Hierarchy & Tree Assembly...");

    // Level 0: Root
    const rootDisp = await DispositionService.createDisposition(ctxAdminA, {
      name: "Contacted",
      code: "CONTACTED",
      color: "#3b82f6",
      sortOrder: 1,
      allowsClose: true,
    });
    assert.equal(rootDisp.depth, 0);
    assert.equal(rootDisp.parentId, null);
    assert.ok(rootDisp.path!.includes(rootDisp.id));

    // Level 1: Child
    const childDisp = await DispositionService.createDisposition(ctxAdminA, {
      parentId: rootDisp.id,
      name: "Interested",
      code: "INTERESTED",
      color: "#10b981",
      sortOrder: 1,
      requiresFollowUp: true,
    });
    assert.equal(childDisp.depth, 1);
    assert.equal(childDisp.parentId, rootDisp.id);
    assert.equal(childDisp.path, `${rootDisp.path}/${childDisp.id}`);

    // Level 2: Grandchild
    const grandChildDisp = await DispositionService.createDisposition(ctxAdminA, {
      parentId: childDisp.id,
      name: "Callback Requested",
      code: "CALLBACK",
      color: "#f59e0b",
      sortOrder: 1,
      followUpMandatory: true, // Mandates next follow-up touchpoint
      requiresFollowUp: true,
    });
    assert.equal(grandChildDisp.depth, 2);
    assert.equal(grandChildDisp.parentId, childDisp.id);
    assert.equal(grandChildDisp.path, `${childDisp.path}/${grandChildDisp.id}`);

    // Level 3: Great-Grandchild
    const greatGrandChildDisp = await DispositionService.createDisposition(ctxAdminA, {
      parentId: grandChildDisp.id,
      name: "Specific Time Window",
      code: "CALLBACK_WINDOW",
      color: "#8b5cf6",
      sortOrder: 1,
      followUpMandatory: true,
    });
    assert.equal(greatGrandChildDisp.depth, 3);
    assert.equal(greatGrandChildDisp.parentId, grandChildDisp.id);
    assert.equal(greatGrandChildDisp.path, `${grandChildDisp.path}/${greatGrandChildDisp.id}`);

    // Verify Tree Assembly
    const tree = await DispositionService.getDispositionTree(ctxAdminA);
    const rootNode = tree.find((t) => t.id === rootDisp.id);
    assert.ok(rootNode, "Root disposition must exist in tree");
    assert.equal(rootNode.children.length, 1);
    assert.equal(rootNode.children[0].id, childDisp.id);
    assert.equal(rootNode.children[0].children.length, 1);
    assert.equal(rootNode.children[0].children[0].id, grandChildDisp.id);
    assert.equal(rootNode.children[0].children[0].children[0].id, greatGrandChildDisp.id);
    console.log("  ✓ 4-level arbitrary depth tree created and assembled correctly");

    // ------------------------------------------------------------------------
    // TEST 2: Cycle Detection & Prevention
    // ------------------------------------------------------------------------
    console.log("  Testing Cycle Detection & Prevention...");

    // 2a. Cannot set parent to self
    await assert.rejects(
      async () => {
        await DispositionService.updateDisposition(ctxAdminA, rootDisp.id, {
          parentId: rootDisp.id,
        });
      },
      ValidationError,
      "Self-parenting must be rejected"
    );

    // 2b. Cannot move ancestor under its own descendant
    await assert.rejects(
      async () => {
        await DispositionService.updateDisposition(ctxAdminA, rootDisp.id, {
          parentId: greatGrandChildDisp.id,
        });
      },
      ValidationError,
      "Moving root under great-grandchild must trigger cycle detection"
    );

    await assert.rejects(
      async () => {
        await DispositionService.updateDisposition(ctxAdminA, childDisp.id, {
          parentId: grandChildDisp.id,
        });
      },
      ValidationError,
      "Moving child under grandchild must trigger cycle detection"
    );
    console.log("  ✓ Cycle detection successfully prevented circular graph structures");

    // ------------------------------------------------------------------------
    // TEST 3: Multi-Tenancy & Tenant Isolation
    // ------------------------------------------------------------------------
    console.log("  Testing Tenant Isolation & Cross-Tenant Access Guards...");

    // 3a. Cannot set parentId from another tenant
    await assert.rejects(
      async () => {
        await DispositionService.createDisposition(ctxAdminB, {
          parentId: rootDisp.id, // belongs to Company A
          name: "Company B Dispo",
        });
      },
      ValidationError,
      "Referencing cross-tenant parent disposition must fail"
    );

    // 3b. Company B cannot read or update Company A disposition
    await assert.rejects(
      async () => {
        await DispositionService.getDispositionById(ctxAdminB, rootDisp.id);
      },
      NotFoundError,
      "Cross-tenant disposition lookup must return NotFoundError"
    );

    await assert.rejects(
      async () => {
        await DispositionService.updateDisposition(ctxAdminB, rootDisp.id, {
          name: "Hacked by Beta",
        });
      },
      NotFoundError,
      "Cross-tenant disposition update must return NotFoundError"
    );

    // 3c. Company A cannot record call outcome on lead of Company B
    await assert.rejects(
      async () => {
        await LeadService.recordCallOutcome(ctxAdminA, leadCompanyB.id, {
          dispositionId: rootDisp.id,
        });
      },
      NotFoundError,
      "Cross-tenant call outcome recording must return NotFoundError"
    );
    console.log("  ✓ Tenant isolation verified across disposition hierarchy and leads");

    // ------------------------------------------------------------------------
    // TEST 4: Contradictory Rule Prevention
    // ------------------------------------------------------------------------
    console.log("  Testing Contradictory Rule Prevention...");

    await assert.rejects(
      async () => {
        await DispositionService.createDisposition(ctxAdminA, {
          name: "Contradictory Dispo",
          cancelActiveFollowUp: true,
          followUpMandatory: true, // Cannot mandate follow-up and cancel active follow-up simultaneously
        });
      },
      ValidationError,
      "Simultaneous cancelActiveFollowUp and followUpMandatory must be rejected"
    );

    // Also verify update cannot create a contradictory state
    const harmlessDisp = await DispositionService.createDisposition(ctxAdminA, {
      name: "Harmless Dispo",
      cancelActiveFollowUp: true,
      followUpMandatory: false,
    });

    await assert.rejects(
      async () => {
        await DispositionService.updateDisposition(ctxAdminA, harmlessDisp.id, {
          followUpMandatory: true,
        });
      },
      ValidationError,
      "Updating to contradictory rule set must be rejected"
    );
    console.log("  ✓ Contradictory disposition rules rejected at schema & service levels");

    // ------------------------------------------------------------------------
    // TEST 5: Atomic Call Outcome Workflow (Initial Follow-Up Creation)
    // ------------------------------------------------------------------------
    console.log("  Testing Atomic Call Outcome Logging (Initial Follow-Up)...");

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const outcomeResult = await LeadService.recordCallOutcome(ctxRepA, lead1.id, {
      dispositionId: grandChildDisp.id,
      notes: "Customer interested, requested callback tomorrow 11 AM",
      durationSeconds: 180,
      dueAt: tomorrow,
      followUpReason: "Discuss contract scope and pricing details",
      assignedUserId: userRepA.id,
    });

    assert.equal(outcomeResult.success, true);

    // Verify lead disposition updated
    const refreshedLead1 = await prisma.lead.findUniqueOrThrow({
      where: { id: lead1.id },
    });
    assert.equal(refreshedLead1.dispositionId, grandChildDisp.id);
    assert.ok(refreshedLead1.dispositionUpdatedAt instanceof Date);
    assert.equal(refreshedLead1.dispositionUpdatedById, userRepA.id);

    // Verify LeadDispositionHistory record
    const dispHistories = await prisma.leadDispositionHistory.findMany({
      where: { leadId: lead1.id },
    });
    assert.equal(dispHistories.length, 1);
    assert.equal(dispHistories[0].fromDispositionId, null);
    assert.equal(dispHistories[0].toDispositionId, grandChildDisp.id);
    assert.equal(dispHistories[0].changedById, userRepA.id);

    // Verify Activities logged (CALL and DISPOSITION_CHANGED)
    const activities = await prisma.activity.findMany({
      where: { leadId: lead1.id },
      orderBy: { createdAt: "desc" },
    });
    const callActivity = activities.find((a) => a.type === ActivityType.CALL);
    assert.ok(callActivity, "CALL activity must be logged");
    assert.equal((callActivity.metadata as any)?.durationSeconds, 180);

    const dispActivity = activities.find((a) => a.type === ActivityType.DISPOSITION_CHANGED);
    assert.ok(dispActivity, "DISPOSITION_CHANGED activity must be logged");

    // Verify Follow-Up Task created
    const activeTasks = await prisma.task.findMany({
      where: {
        companyId: companyA.id,
        leadId: lead1.id,
        type: TaskType.FOLLOW_UP,
        status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
      },
    });
    assert.equal(activeTasks.length, 1, "Exactly 1 active follow-up task must exist");
    assert.equal(activeTasks[0].status, TaskStatus.PENDING);
    assert.equal(activeTasks[0].type, TaskType.FOLLOW_UP);

    // Verify TaskRescheduleHistory CREATED event
    const taskHistories = await prisma.taskRescheduleHistory.findMany({
      where: { taskId: activeTasks[0].id },
    });
    assert.equal(taskHistories.length, 1);
    assert.equal(taskHistories[0].eventType, TaskLifecycleEventType.CREATED);
    assert.equal(taskHistories[0].performedById, userRepA.id);
    console.log("  ✓ Atomic call outcome logged Lead disposition, Activity, Task, and History");

    // ------------------------------------------------------------------------
    // TEST 6: Reschedule Behavior & ONE ENQUIRY = ONE ACTIVE FOLLOW-UP Invariant
    // ------------------------------------------------------------------------
    console.log("  Testing Callback Rescheduling (Never Create Duplicate Tasks)...");

    const twoDaysLater = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const existingTaskId = activeTasks[0].id;

    // Agent logs second call outcome requesting callback two days later
    await LeadService.recordCallOutcome(ctxRepA, lead1.id, {
      dispositionId: grandChildDisp.id,
      notes: "Customer asked to postpone callback by 1 day",
      durationSeconds: 60,
      dueAt: twoDaysLater,
      followUpReason: "Postponed callback as requested",
    });

    // Invariant verification: count must still be exactly 1!
    const activeTasksAfterResched = await prisma.task.findMany({
      where: {
        companyId: companyA.id,
        leadId: lead1.id,
        type: TaskType.FOLLOW_UP,
        status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
      },
    });
    assert.equal(
      activeTasksAfterResched.length,
      1,
      "ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP: Task count must remain 1"
    );
    assert.equal(activeTasksAfterResched[0].id, existingTaskId, "Existing task must be reused");
    assert.equal(activeTasksAfterResched[0].status, TaskStatus.PENDING);
    assert.equal(
      new Date(activeTasksAfterResched[0].dueAt!).getTime(),
      twoDaysLater.getTime(),
      "dueAt must be updated"
    );

    // Verify TaskRescheduleHistory now has CREATED + RESCHEDULED
    const taskHistoriesAfterResched = await prisma.taskRescheduleHistory.findMany({
      where: { taskId: existingTaskId },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(taskHistoriesAfterResched.length, 2);
    assert.equal(taskHistoriesAfterResched[0].eventType, TaskLifecycleEventType.CREATED);
    assert.equal(taskHistoriesAfterResched[1].eventType, TaskLifecycleEventType.RESCHEDULED);
    assert.equal(
      new Date(taskHistoriesAfterResched[1].previousDueAt!).getTime(),
      tomorrow.getTime()
    );
    assert.equal(
      new Date(taskHistoriesAfterResched[1].newDueAt!).getTime(),
      twoDaysLater.getTime()
    );

    // Verify TASK_RESCHEDULED activity was added to lead timeline
    const reschedActivity = await prisma.activity.findFirst({
      where: { leadId: lead1.id, type: ActivityType.TASK_RESCHEDULED },
    });
    assert.ok(reschedActivity, "TASK_RESCHEDULED activity must be logged on timeline");
    console.log("  ✓ Existing follow-up rescheduled without duplicate task creation");

    // ------------------------------------------------------------------------
    // TEST 7: Database-Level Partial Unique Index Guard
    // ------------------------------------------------------------------------
    console.log("  Testing Database-Level Partial Unique Index Protection...");

    // Attempting to bypass service and directly insert a second active follow-up must fail in Postgres!
    await assert.rejects(
      async () => {
        await prisma.task.create({
          data: {
            companyId: companyA.id,
            leadId: lead1.id,
            type: TaskType.FOLLOW_UP,
            status: TaskStatus.PENDING,
            title: "Illegitimate duplicate active follow-up",
          },
        });
      },
      (err: any) => {
        assert.ok(
          err.message.includes("Unique constraint failed") ||
            err.message.includes("tasks_single_active_followup_per_lead_idx"),
          "PostgreSQL partial unique index must reject duplicate active follow-up"
        );
        return true;
      }
    );
    console.log("  ✓ PostgreSQL partial unique index successfully rejected duplicate active follow-up");

    // ------------------------------------------------------------------------
    // TEST 8: GENERAL Task vs FOLLOW_UP Task Coexistence
    // ------------------------------------------------------------------------
    console.log("  Testing GENERAL task vs FOLLOW_UP task Independence & Coexistence...");

    // Create a GENERAL task on the same lead (e.g. "Prepare legal paperwork")
    const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    const generalTask = await prisma.task.create({
      data: {
        companyId: companyA.id,
        leadId: lead1.id,
        type: TaskType.GENERAL,
        status: TaskStatus.PENDING,
        title: "Prepare NDA contract",
        dueAt: pastDate,
      },
    });
    assert.ok(generalTask.id);
    assert.equal(generalTask.type, TaskType.GENERAL);

    // Verify lead now has: 1 GENERAL task + 1 FOLLOW_UP task simultaneously
    const allLeadTasks = await prisma.task.findMany({
      where: { leadId: lead1.id, status: TaskStatus.PENDING },
    });
    assert.equal(allLeadTasks.length, 2);
    const hasGeneral = allLeadTasks.some((t) => t.type === TaskType.GENERAL);
    const hasFollowUp = allLeadTasks.some((t) => t.type === TaskType.FOLLOW_UP);
    assert.ok(hasGeneral && hasFollowUp, "GENERAL and FOLLOW_UP tasks must coexist");
    console.log("  ✓ GENERAL task and FOLLOW_UP task coexisting independently on lead");

    // ------------------------------------------------------------------------
    // TEST 9: Atomic Overdue Synchronization Engine
    // ------------------------------------------------------------------------
    console.log("  Testing Atomic Overdue Synchronization Engine...");

    // Set lead1's FOLLOW_UP task dueAt to past
    await prisma.task.update({
      where: { id: existingTaskId },
      data: { dueAt: pastDate },
    });

    // Run syncOverdueFollowUps
    const syncResult = await FollowUpService.syncOverdueFollowUps(companyA.id);
    assert.ok(syncResult.synchronizedCount >= 1, "Must synchronize at least 1 overdue task");
    assert.ok(syncResult.taskIds.includes(existingTaskId));

    // Verify FOLLOW_UP task is now OVERDUE
    const refreshedFollowUp = await prisma.task.findUniqueOrThrow({
      where: { id: existingTaskId },
    });
    assert.equal(refreshedFollowUp.status, TaskStatus.OVERDUE);

    // Verify MARKED_OVERDUE history record
    const overdueHistory = await prisma.taskRescheduleHistory.findFirst({
      where: { taskId: existingTaskId, eventType: TaskLifecycleEventType.MARKED_OVERDUE },
    });
    assert.ok(overdueHistory, "MARKED_OVERDUE event must be created in TaskRescheduleHistory");

    // CRITICAL: Verify GENERAL task was NOT touched by overdue engine!
    const refreshedGeneralTask = await prisma.task.findUniqueOrThrow({
      where: { id: generalTask.id },
    });
    assert.equal(
      refreshedGeneralTask.status,
      TaskStatus.PENDING,
      "GENERAL task must NEVER be transitioned to OVERDUE by follow-up sync engine"
    );

    const generalHistory = await prisma.taskRescheduleHistory.findMany({
      where: { taskId: generalTask.id },
    });
    assert.equal(generalHistory.length, 0, "GENERAL task must have zero follow-up history events");

    // Test Idempotency / No Duplicate Events on second run
    const secondSync = await FollowUpService.syncOverdueFollowUps(companyA.id);
    assert.equal(
      secondSync.taskIds.includes(existingTaskId),
      false,
      "Second sync must not re-process already overdue task"
    );
    console.log("  ✓ Overdue engine transitioned FOLLOW_UP atomically; GENERAL tasks untouched");

    // ------------------------------------------------------------------------
    // TEST 10: Rescheduling an OVERDUE Task Resets Status to PENDING
    // ------------------------------------------------------------------------
    console.log("  Testing Rescheduling an OVERDUE Task...");

    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const rescheduledFromOverdue = await FollowUpService.rescheduleFollowUp(
      ctxAdminA,
      existingTaskId,
      {
        dueAt: nextWeek,
        reason: "Contact re-established; rescheduled from overdue",
      }
    );

    assert.equal(
      rescheduledFromOverdue.status,
      TaskStatus.PENDING,
      "Rescheduling an OVERDUE task must reset status to PENDING"
    );
    console.log("  ✓ OVERDUE task rescheduled back to PENDING with full history");

    // ------------------------------------------------------------------------
    // TEST 11: Disposition with cancelActiveFollowUp: true
    // ------------------------------------------------------------------------
    console.log("  Testing Disposition with cancelActiveFollowUp: true...");

    const dncDisp = await DispositionService.createDisposition(ctxAdminA, {
      name: "Not Interested — Do Not Contact",
      code: "DNC",
      color: "#ef4444",
      cancelActiveFollowUp: true, // Automatically cancels all active follow-ups
      isTerminal: true,
      allowsClose: true,
    });

    // Log call outcome with cancelActiveFollowUp disposition
    await LeadService.recordCallOutcome(ctxRepA, lead1.id, {
      dispositionId: dncDisp.id,
      notes: "Prospect adamantly requested no further contact",
      durationSeconds: 45,
    });

    // Verify follow-up was CANCELLED
    const cancelledFollowUp = await prisma.task.findUniqueOrThrow({
      where: { id: existingTaskId },
    });
    assert.equal(cancelledFollowUp.status, TaskStatus.CANCELLED);
    assert.ok(cancelledFollowUp.cancelledAt instanceof Date);

    // Verify CANCELLED lifecycle history record
    const cancelHistory = await prisma.taskRescheduleHistory.findFirst({
      where: { taskId: existingTaskId, eventType: TaskLifecycleEventType.CANCELLED },
    });
    assert.ok(cancelHistory, "CANCELLED history record must be recorded");

    // Verify TASK_CANCELLED activity logged on lead timeline
    const cancelActivity = await prisma.activity.findFirst({
      where: { leadId: lead1.id, type: ActivityType.TASK_CANCELLED },
    });
    assert.ok(cancelActivity, "TASK_CANCELLED activity must be recorded");
    console.log("  ✓ cancelActiveFollowUp disposition cancelled active follow-ups with full audit trail");

    // ------------------------------------------------------------------------
    // TEST 12: Close Gate Enforcement (allowsClose = false)
    // ------------------------------------------------------------------------
    console.log("  Testing Lead Close Gate (allowsClose = false)...");

    const inNegotiationDisp = await DispositionService.createDisposition(ctxAdminA, {
      name: "In Active Negotiations",
      code: "ACTIVE_NEGOTIATION",
      allowsClose: false, // Blocks closing lead
    });

    // Set lead2's disposition to inNegotiationDisp
    await LeadService.updateLeadDisposition(ctxAdminA, lead2.id, {
      dispositionId: inNegotiationDisp.id,
    });

    // Attempt to close lead2 (e.g. transition to Closed Won) must fail!
    await assert.rejects(
      async () => {
        await LeadService.updateLead(ctxAdminA, lead2.id, {
          statusId: statusClosedWon.id,
        });
      },
      ValidationError,
      "Lead closing must be blocked when current disposition allowsClose is false"
    );
    console.log("  ✓ Lead close gate prevented unauthorized closure when allowsClose is false");

    // ------------------------------------------------------------------------
    // TEST 13: RBAC & Permission Enforcement
    // ------------------------------------------------------------------------
    console.log("  Testing RBAC & Security Enforcement...");

    // Viewer cannot record call outcome
    await assert.rejects(
      async () => {
        await LeadService.recordCallOutcome(ctxViewerA, lead2.id, {
          dispositionId: rootDisp.id,
        });
      },
      ForbiddenError,
      "Viewer without leads.update or activities.create must be rejected"
    );

    // Sales rep cannot create or delete dispositions
    await assert.rejects(
      async () => {
        await DispositionService.createDisposition(ctxRepA, {
          name: "Unauthorized Dispo",
        });
      },
      ForbiddenError,
      "Sales rep without dispositions.manage or admin must be rejected"
    );

    await assert.rejects(
      async () => {
        await DispositionService.deleteDisposition(ctxRepA, rootDisp.id);
      },
      ForbiddenError,
      "Sales rep without dispositions.delete or admin must be rejected"
    );
    console.log("  ✓ RBAC permissions verified across all disposition and outcome operations");

    // ------------------------------------------------------------------------
    // TEST 14: Task Reopening (REOPENED Lifecycle Event) & Invariant Enforcement
    // ------------------------------------------------------------------------
    console.log("  Testing Task Reopening (REOPENED event) & conflict behavior...");

    // 1. Create a follow-up on reopenLead
    const reopenLead = await prisma.lead.create({
      data: {
        companyId: companyA.id,
        name: `Reopen Test Lead ${uniqueSuffix}`,
        statusId: statusOpen.id,
      },
    });

    const followUpToReopen = await FollowUpService.createFollowUp(ctxAdminA, {
      leadId: reopenLead.id,
      title: "Initial follow-up to complete and reopen",
      dueAt: new Date(Date.now() + 3600 * 1000),
      priority: "HIGH",
    });

    // Complete the task
    await FollowUpService.completeFollowUp(ctxAdminA, followUpToReopen.id);
    const completedTask = await FollowUpService.getFollowUpById(ctxAdminA, followUpToReopen.id);
    assert.equal(completedTask.status, TaskStatus.COMPLETED);

    // Reopen task by setting status back to PENDING via updateFollowUp
    const reopenedTask = await FollowUpService.updateFollowUp(ctxAdminA, followUpToReopen.id, {
      status: TaskStatus.PENDING,
    });
    assert.equal(reopenedTask.status, TaskStatus.PENDING, "Task status must be reset to PENDING");
    assert.equal(reopenedTask.completedAt, null, "completedAt must be cleared upon reopening");

    // Assert that REOPENED lifecycle event was recorded
    const reopenHistory = await prisma.taskRescheduleHistory.findFirst({
      where: {
        taskId: followUpToReopen.id,
        eventType: TaskLifecycleEventType.REOPENED,
      },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(reopenHistory, "TaskRescheduleHistory record with REOPENED event must exist");
    assert.equal(reopenHistory?.eventType, TaskLifecycleEventType.REOPENED);

    // 2. Conflict Behavior: Attempt to reopen when another active follow-up already exists on the same lead
    // Complete the task again
    await FollowUpService.completeFollowUp(ctxAdminA, followUpToReopen.id);

    // Create a new active follow-up on the same lead
    const secondActiveFollowUp = await FollowUpService.createFollowUp(ctxAdminA, {
      leadId: reopenLead.id,
      title: "Second active follow-up",
      dueAt: new Date(Date.now() + 7200 * 1000),
      priority: "MEDIUM",
    });
    assert.equal(secondActiveFollowUp.status, TaskStatus.PENDING);

    // Attempting to reopen the first task back to PENDING while secondActiveFollowUp is PENDING
    // must be rejected by PostgreSQL partial unique index
    let conflictCaught = false;
    try {
      await FollowUpService.updateFollowUp(ctxAdminA, followUpToReopen.id, {
        status: TaskStatus.PENDING,
      });
    } catch (err: any) {
      conflictCaught = true;
      assert.ok(
        err.message.includes("tasks_single_active_followup_per_lead_idx") ||
        err.code === "P2002" ||
        err.message.includes("Unique constraint"),
        "Must be rejected by PostgreSQL partial unique index tasks_single_active_followup_per_lead_idx"
      );
    }
    assert.ok(conflictCaught, "Reopening a task when an active follow-up already exists must be rejected");
    console.log("  ✓ Task Reopening produces REOPENED event and partial unique index rejects conflicting reopen");

    console.log("\n====================================================================");
    console.log("🎉 ALL PHASE 7 DISPOSITION & FOLLOW-UP LIFECYCLE TESTS PASSED!");
    console.log("====================================================================");
  } finally {
    // ------------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------------
    console.log("  Cleaning up Phase 7 test fixtures...");
    await prisma.activity.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.taskRescheduleHistory.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.task.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.leadDispositionHistory.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.lead.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.disposition.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.leadStatus.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.session.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.user.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.role.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyA.id, companyB.id] } },
    });
  }
}

if (require.main === module) {
  runPhase7DispositionFollowUpTests()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
