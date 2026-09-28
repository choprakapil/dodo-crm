---
name: browser-verification
description: "Use for any user-facing web flow before it can be marked complete or verified."
---

# Browser Verification

**Purpose:** Use real browser verification for user-facing flows. Do not infer that a flow works from source code inspection alone.

## When to use this skill
Use for any user-facing web flow before it can be marked complete or verified.

## Steps
1. Actually load the affected page(s) in a browser (or Antigravity's browser agent) and exercise the flow end to end.
2. Check both the happy path and at least one realistic failure path (bad input, denied auth, empty state).
3. Note exactly what was clicked/submitted and what was observed, in plain terms.

## Evidence required
A short observed-behavior log (steps taken -> what appeared) or screenshot reference, stored with the task record. Reading the component code does not satisfy this skill.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
