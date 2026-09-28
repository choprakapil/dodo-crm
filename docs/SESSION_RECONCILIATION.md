[RULE]

# Session Reconciliation Checklist

At the start of every session, before touching code, verify that the saved
state still matches the actual repository. Stale records can be worse than no
records — they silently guide you wrong.

**Time:** ~5-10 minutes depending on project size.

**Output:** A reconciliation report in `docs/memory/SESSION_RECONCILIATION_LOG.md`.

---

## Before Starting

Read these files in order:
1. `docs/memory/PROJECT_STATE.md` (overall phase)
2. `docs/memory/NEXT_TASK.md` (what should happen next)
3. `docs/memory/SESSION_STATE.md` (what the last session was doing)
4. `docs/memory/COMPLETED_WORK.md` (what claims to be done)
5. `docs/memory/KNOWN_ISSUES.md` (what's broken/blocked)
6. `docs/memory/AGENT_HANDOFF.md` (agent's message to next session)

---

## Reconciliation Steps

### 1. Verify Project Phase (2 min)

**Claim in memory:** `docs/memory/PROJECT_STATE.md` says phase is `BUILD`

**Check in reality:**
```bash
cd repo_root
# Is there actual code that looks built?
ls -la src/ api/ frontend/
# Does docs/PRD.md have real content (not empty template)?
head -50 docs/PRD.md
```

**Questions:**
- [ ] Does the repository actually contain code at the claimed phase? (Yes / No / Partial)
- [ ] Are the spec documents (PRD, TRD, etc.) filled in or still empty?
- [ ] If code exists, is it recent (last modified in the current project) or old?

**What to do if mismatch:**
- If memory says DISCOVERY but there's production code → phase is wrong, update to BUILD or RELEASE
- If memory says COMPLETE but there are uncommitted changes → session ended abruptly, update SESSION_STATE

---

### 2. Verify Completed Work Claims (3 min)

**Claim in memory:** `docs/memory/COMPLETED_WORK.md` lists 5 tasks as COMPLETE

**Check in reality:**
Pick one completed task and inspect:
```bash
# Task: "AUTH-001: User login"
# Claim: Tests pass, browser verified, deployed

# Is the code actually there?
grep -r "POST /api/auth/login" src/
git log --oneline -n 20 | grep -i login

# Do the tests actually pass?
npm test -- auth.test.js
```

**Questions:**
- [ ] Can I find the code claimed to be implemented?
- [ ] Does the code match what the task claimed to build?
- [ ] If tests are claimed to pass, do they actually pass when run now?
- [ ] Are there obvious TODOs or incomplete code in the files?

**What to do if mismatch:**
- Task claims completion but code is missing → mark INCOMPLETE in TASK_REGISTRY, move back to IN_PROGRESS
- Task was completed but has since broken → investigate if another change broke it (see "Regressions")
- Task claims "tests pass" but no test file exists → mark BLOCKED, update BLOCKED_TASKS.md

---

### 3. Check for Regressions (2 min)

**Questions:**
- [ ] Do all tests still pass? (Run: `npm test` or equivalent)
- [ ] Is the build clean? (Run: `npm run build` or equivalent)
- [ ] Any obvious syntax errors or type mismatches? (Run linter if available)

**What to do if tests fail:**
```bash
# Are they new failures or old?
git log --oneline -n 5  # When was the last real commit?
git status  # Are there uncommitted changes that broke something?
```

If the test was passing before:
- Mark the task that broke it as BLOCKED
- Create new entry in BLOCKED_TASKS.md
- Don't continue as if it's still working

---

### 4. Verify Next Task is Valid (1 min)

**Claim in memory:** `docs/memory/NEXT_TASK.md` says "continue with AUTH-002: OAuth"

**Check in reality:**
- [ ] Does AUTH-002 exist in `docs/TASK_REGISTRY.md`?
- [ ] Are its dependencies actually complete? (Check the tasks it depends on)
- [ ] Is the spec for OAuth actually frozen in `docs/PRD.md` / `docs/TRD.md`?

**What to do if next task is invalid:**
- If the task was skipped and is no longer relevant → find the actual next task in TASK_REGISTRY
- If a dependency is missing → pick a different task that doesn't have that dependency
- If the spec is unclear → run discovery/questions loop before starting the task

---

### 5. Check Known Issues (1 min)

**Claim in memory:** `docs/memory/KNOWN_ISSUES.md` lists 2 known issues

**Check in reality:**
```bash
# For each issue, verify it actually exists or has been fixed
# Example issue: "Build fails on Node 18"

node --version  # What version is actually running?
npm run build  # Does it actually fail?
```

**What to do if issue is gone:**
- Remove it from KNOWN_ISSUES.md (it may have been fixed in a previous session)

**What to do if issue is worse:**
- Add details (error messages, reproduction steps)
- Update priority/SLA if needed
- Link to relevant BLOCKED_TASKS.md entries

---

### 6. Verify State File Timestamps (1 min)

**Check:**
```bash
ls -la docs/memory/
# Is SESSION_STATE.md recent (from today or recent session)?
# Or is it weeks old (old project, long pause)?
```

**What to do if state files are very old:**
- Project may have genuinely been paused for a long time
- Verify nothing external changed (team left, requirements shifted, tech stack updated)
- If resuming after a long pause, run full reconciliation + any external context checks

---

## Output: Reconciliation Report

After finishing the 6 steps above, create an entry in `docs/memory/SESSION_RECONCILIATION_LOG.md`:

```markdown
## Session Reconciliation - 2026-09-08 11:00 UTC

**Last session:** 2026-09-07 16:30 UTC

### State vs. Reality

| Item | Claimed | Actual | Match? | Action |
|---|---|---|---|---|
| Phase | BUILD | BUILD | ✓ | Continue |
| COMPLETED: AUTH-001 | Tests pass, deployed | Code exists, tests pass ✓ | ✓ | Valid |
| NEXT_TASK | AUTH-002: OAuth | In TASK_REGISTRY, spec ready | ✓ | Continue with AUTH-002 |
| Build status | Passing | ✓ Clean build | ✓ | Continue |
| Known issues | 2 items | 1 fixed, 1 still there | ⚠️ | Remove fixed issue |

### Decisions
- ✓ All claims match reality
- ⚠️ Removed KNOWN_ISSUE #3 (was fixed in previous session)
- ✓ Project is ready to continue

**Next action:** Begin task AUTH-002: OAuth login integration

**Reconciliation done at:** 2026-09-08 11:05 UTC by [agent-name]
```

---

## Quick Reference: Red Flags

If you see any of these, stop and investigate before continuing:

| Red Flag | What It Means | What To Do |
|---|---|---|
| COMPLETED task is missing from repo | Task was done but code was deleted/lost | Restore from git or re-implement; update TASK_REGISTRY |
| Tests pass in COMPLETED_WORK but fail now | Regression since last session | Mark task BLOCKED, investigate root cause |
| NEXT_TASK doesn't exist in TASK_REGISTRY | Next task was deleted or memory is stale | Find actual next task, update NEXT_TASK.md |
| STATE files are months old | Long project pause | Confirm external context hasn't changed (team, requirements, stack) |
| Uncommitted changes conflict with COMPLETED_WORK | Work was done but not committed | Either commit the work or discard it; clarify status |
| git log shows recent commits but memory has no record | Previous session didn't write state | Update memory files with the missing work |

---

## When to Run Full Reconciliation vs. Quick Sync

### Full Reconciliation (5-10 min)
- Resuming after > 24 hours pause
- Multiple people have worked on the project
- Any doubt about current state
- Before deploying or marking anything COMPLETE

### Quick Sync (1 min)
- Resuming same day
- Only you have been working on it
- Confident in last session's notes
- Just picking up where you left off

**When in doubt, do full reconciliation.** Time spent verifying is time not wasted on a wrong assumption.
