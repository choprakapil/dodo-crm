---
name: session-continuity
description: "Use at the start and end of every working session."
---

# Session Continuity

**Purpose:** Persist state after every meaningful session and verify it against the actual repository when resuming, so no session starts from a false assumption.

## When to use this skill
Use at the start and end of every working session.

## Steps
1. At session start, read the six `docs/memory/` continuity files and then inspect the real repository to confirm they still match reality.
2. At session end, follow `docs/SESSION_CLOSE_PROTOCOL.md` and write exact files changed, evidence, and the next task.

## Evidence required
An updated `docs/memory/SESSION_STATE.md` and `docs/memory/NEXT_TASK.md` at the end of every session.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
