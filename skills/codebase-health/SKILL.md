---
name: codebase-health
description: "Use periodically and before final audit to check overall maintainability, not just the current task."
---

# Codebase Health

**Purpose:** Audit duplication, dead code, dependency waste, complexity hotspots, type errors, test health, and route integrity across the whole codebase.

## When to use this skill
Use periodically and before final audit to check overall maintainability, not just the current task.

## Steps
1. Run available linters/type-checkers/test suites and record actual output, not an impression.
2. Look for duplicate logic and oversized files introduced by recent work.
3. Update `docs/memory/CODE_HEALTH.md` with findings.

## Evidence required
Actual linter/type-checker/test output pasted or summarized with pass/fail counts.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
