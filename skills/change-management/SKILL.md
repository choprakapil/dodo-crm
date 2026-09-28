---
name: change-management
description: "Use whenever a new or changed requirement appears after the specification has been frozen."
---

# Change Management

**Purpose:** After specification freeze, requirement changes must be recorded before implementation, not folded silently into the current task.

## When to use this skill
Use whenever a new or changed requirement appears after the specification has been frozen.

## Steps
1. Classify the request: already covered by the spec, a clarification, or a genuine post-freeze change.
2. For a genuine change, log it in `docs/memory/CHANGE_REQUESTS.md` with reason, impact, and affected requirements.
3. Update the affected spec file(s) and the task graph before writing any code for the change.

## Evidence required
The change-request entry plus a diff/list of which spec sections and tasks were updated as a result.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
