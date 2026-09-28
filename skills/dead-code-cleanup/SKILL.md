---
name: dead-code-cleanup
description: "Use when removing unused code, stale routes, obsolete files, or unused dependencies."
---

# Dead Code Cleanup

**Purpose:** Identify and safely remove unused code, stale routes, obsolete files, and unused dependencies without breaking anything still in use.

## When to use this skill
Use when removing unused code, stale routes, obsolete files, or unused dependencies.

## Steps
1. Search for real references before deleting anything; do not delete based on the name looking unused.
2. Remove in a separate, clearly-labeled step from feature work, not silently mixed into an unrelated change.
3. Re-run tests after removal to confirm nothing depended on it.

## Evidence required
Search results showing zero remaining references, and the test run after removal.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
