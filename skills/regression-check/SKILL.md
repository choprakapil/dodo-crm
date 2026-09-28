---
name: regression-check
description: "Use after any change that could plausibly affect existing, previously-working behavior."
---

# Regression Check

**Purpose:** Run targeted and broader tests after changes that could affect existing behavior, so old features are not silently broken by new work.

## When to use this skill
Use after any change that could plausibly affect existing, previously-working behavior.

## Steps
1. Identify what else touches the changed code (search for callers/consumers).
2. Run the existing test suite for the affected area, and add a test if the regression risk was previously uncovered.
3. Record pass/fail results, not an assumption that 'it should still work'.

## Evidence required
Actual test run output from before and after the change, or a clear note of what was and wasn't covered.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
