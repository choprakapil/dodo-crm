---
name: final-audit
description: "Use before declaring a project, milestone, or release complete."
---

# Final Audit

**Purpose:** Adversarially verify every mandatory completion gate and reject unsupported completion claims, rather than rubber-stamping existing checkmarks.

## When to use this skill
Use before declaring a project, milestone, or release complete.

## Steps
1. Re-check evidence for every gate in `docs/COMPLETION_GATES.md` yourself; do not trust prior 'done' claims without evidence.
2. Actively look for missing pieces: unfinished layers, dead links, unintegrated APIs, dead code, missing tests.
3. Reject completion and list concrete gaps if any gate lacks real evidence.

## Evidence required
A pass/fail note per gate in `docs/FINAL_VERIFICATION.md`, each backed by evidence per `docs/EVIDENCE_STANDARDS.md`.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
