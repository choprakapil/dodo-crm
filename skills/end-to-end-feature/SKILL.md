---
name: end-to-end-feature
description: "Use whenever implementing any feature, to make sure every required layer is actually finished, not just the UI or just the API."
---

# End-to-End Feature

**Purpose:** Complete all applicable layers, from UI through data, integrations, tests, and verification, before calling a feature done.

## When to use this skill
Use whenever implementing any feature, to make sure every required layer is actually finished, not just the UI or just the API.

## Steps
1. List which layers apply to this feature using the row structure in `docs/FEATURE_COMPLETION_MATRIX.md`.
2. Implement and verify each applicable layer in the same task rather than leaving layers for 'later'.
3. Update the feature's row in the matrix only when every applicable cell has real evidence.

## Evidence required
An updated row in `docs/FEATURE_COMPLETION_MATRIX.md` with every applicable cell marked from real, checked work.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
