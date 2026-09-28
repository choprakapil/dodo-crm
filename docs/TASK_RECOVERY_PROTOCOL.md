[RULE]

# Task Recovery Protocol

When a task gets stuck, blocked, or derailed mid-implementation, follow this.
Do NOT silently skip the task or pretend it's done. Recovery is part of normal work.

---

## 1. Recognize the Situation

A task needs recovery if any of these are true:
- A required dependency is unavailable or broken
- A test is failing and the root cause is unclear
- The requirement became ambiguous mid-task
- A new bug/flaw was discovered that breaks the approach
- Browser verification failed in an unexpected way
- A blocker appeared that requires external action (another team, service outage, etc.)
- You realize mid-task that the approach is fundamentally wrong

**Stop working on the task immediately.** Continuing will only deepen the problem.

---

## 2. Diagnose the Blocker (5 min)

Ask and answer:

| Question | Example Answer |
|---|---|
| **What is actually stuck?** | Test suite fails on database migration |
| **What's the root cause?** | New dependency has breaking change in v3.0; we're on v2.8 |
| **What do we need to unblock?** | Either downgrade to v2.8 or refactor to v3.0 API |
| **Who can decide?** | Technical architect + backend engineer |
| **How long would a real fix take?** | 2-4 hours to refactor to v3.0 |
| **Is there a workaround for now?** | Yes: use v2.8 branch in package.json; handle v3.0 upgrade in later task |

---

## 3. Mark the Task BLOCKED in TASK_REGISTRY.md

Update `docs/TASK_REGISTRY.md` with:

```markdown
| AUTH-001 | User login | BLOCKED | dependency-outdated | backend-eng | See docs/BLOCKED_TASKS.md#AUTH-001 |
```

---

## 4. Document the Block in BLOCKED_TASKS.md (new file)

Create `docs/BLOCKED_TASKS.md` with one entry per blocked task:

```markdown
## AUTH-001: User Login (Blocked)

**Status:** BLOCKED since 2026-09-08 10:45 UTC

**Blocker:** express-session v3.0 breaking change (session.id removed; refactor needed)

**Impact:** Cannot complete login flow without migrating to v3.0 API or downgrading library

**Options considered:**
1. Refactor to v3.0 API (estimated: 2-4 hours, blocks this task)
2. Downgrade to express-session v2.8 (estimated: 30 min, unblocks now, defers v3.0 upgrade)
3. Use alternative session library (estimated: 8+ hours, risky refactor, low priority)

**Recommended action:** Option 2 (downgrade to v2.8 for now)

**Recovery path:**
1. In package.json, set express-session to ^2.8.0
2. Run npm install, confirm old version installed
3. Rerun tests; they should pass
4. Create a separate task: "EXPRESS-SESSION-UPGRADE-001: Migrate to express-session v3.0"
5. Unblock AUTH-001 and continue

**Depends on:** None (can unblock immediately)

**Blocks:** None (other tasks don't depend on this one yet)

**Assigned to:** backend-engineer

**Decision needed by:** Anyone who can approve a library downgrade (tech-architect or lead)

**Last updated:** 2026-09-08 10:45 UTC
```

---

## 5. Three Recovery Paths

### Path A: UNBLOCK IMMEDIATELY (Quick Fix)
**Use if:** The blocker has a clear, low-risk workaround that can be applied right now.

Example: Downgrade a library version, use a feature flag to skip a flaky test, switch to a staging API endpoint.

1. Apply the workaround
2. Rerun the critical test/verification to confirm it passes
3. Update the task: status back to `IN PROGRESS`
4. Create a follow-up task to handle the real fix
5. Continue the original task

Record in task:
```
Recovery applied: downgraded express-session to v2.8.0 (workaround)
Follow-up task: EXPRESS-SESSION-UPGRADE-001 (scheduled for later)
```

---

### Path B: DEFER THE BLOCKER (Create Dependency)
**Use if:** The blocker requires someone else's work or an external service/approval.

Example: Waiting for payments team to enable sandbox mode, waiting for database team to run a migration, waiting for design review on a component.

1. Clearly name the blocker and the person/team who can resolve it
2. Set an SLA (e.g., "unblock by EOD Friday")
3. Mark the task `BLOCKED` and move to the next unblocked task
4. Add a calendar reminder to follow up if the blocker is not resolved by the SLA

Record in task:
```
Blocker: Payments sandbox environment not enabled
Owned by: payments-team
SLA: Unblock by 2026-09-10 EOD
Fallback: Test with mock payment responses (lower fidelity, but unblocks current task)
```

---

### Path C: RETHINK THE APPROACH (Replan)
**Use if:** Continuing with the current approach is fundamentally wrong (wrong requirement, wrong architecture, new constraint discovered).

1. Stop implementation
2. Call a brief sync with the product manager + technical architect
3. Discuss: Is the requirement still right? Does the approach still make sense?
4. If the requirement changed: run `docs/CHANGE_REQUEST.md` (post-freeze change protocol)
5. If the approach is wrong: update the task plan in `TASK_TEMPLATE.md` and restart
6. If the requirement is still right but the approach is broken: break the task into smaller pieces

Record in task:
```
Rethink triggered: discovered that the login flow requires support for OAuth (not in original spec)
Action: Run change-request protocol; add OAuth as new requirement
Replanned tasks: AUTH-001 (email/password login), AUTH-002 (OAuth integration)
```

---

## 6. Update Memory Files

Before moving to the next task, update:

- `docs/memory/KNOWN_ISSUES.md` — Add the blocker
- `docs/memory/NEXT_TASK.md` — What happens next (unblock action, or next unblocked task)
- `docs/BLOCKED_TASKS.md` — Full diagnosis and recovery path
- `docs/TASK_REGISTRY.md` — Mark as BLOCKED, link to BLOCKED_TASKS.md

---

## 7. Communicate Status

If the blocker affects other work or delays release:
1. Update the admin panel (if in use) to show project is blocked
2. Notify the team: send a message with the blocker + recovery plan
3. Assign the recovery action to someone specific (not "whoever gets to it")

---

## 8. When the Blocker Resolves

Once the blocker is fixed (dependency updated, other team finishes, approval received):

1. Verify the fix actually works (don't assume)
2. Update `docs/BLOCKED_TASKS.md` with resolution timestamp
3. Update `docs/TASK_REGISTRY.md`: change status back to `IN PROGRESS`
4. Continue the task from where it paused
5. Rerun the test/verification that was failing
6. If it still fails, repeat the recovery protocol

---

## Example: Real Blocker → Unblock

**Scenario:** Database migration failed, tests are failing.

```markdown
## SCHEMA-001: Add user_roles column (Blocked)

**Status:** BLOCKED since 2026-09-08 10:30 UTC

**Blocker:** Migration rollback failed; database is in inconsistent state

**Root cause:** Migration created foreign key constraint BEFORE populating the new column; 
during rollback, the constraint prevented the column from being dropped.

**Resolution:**
1. Manually delete the constraint: ALTER TABLE users DROP CONSTRAINT fk_user_roles;
2. Rerun migrations fresh: npm run migrate:reset (on staging only)
3. Rerun tests: npm test -- schema.test.js
4. Tests pass ✓

**Status update:** UNBLOCKED, changed back to IN PROGRESS

**Lesson learned:** Future migrations: populate data BEFORE adding constraints
```

---

## When Recovery Fails

If recovery attempts have not unblocked the task after 2+ hours of real effort:

1. Escalate to technical architect or project lead
2. Decide: Is this task genuinely unblockable right now? (Yes → defer; No → continue recovery)
3. If deferring: move to next unblocked task; schedule the original for later
4. Never claim a blocked task is complete

---

## Summary

| Scenario | Action |
|---|---|
| Quick fix available | Apply it, continue task |
| Waiting for external input | Set SLA, move to next task |
| Requirement was wrong | Run change-request protocol, replan |
| Approach is broken | Rethink with tech-architect, break into smaller tasks |
| Blocker can't be resolved | Escalate; defer the task |
