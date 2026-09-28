[RULE]

# AI Self-Check

Every "yes" below must be backed by evidence as defined in
`docs/EVIDENCE_STANDARDS.md`. A "yes" that is only a confident impression is
actually a "no" — answer honestly, not optimistically.

Before declaring a task complete ask:
- Did I inspect existing code before creating new code?
- Did I duplicate anything?
- Did I leave dead code?
- Did I leave TODOs/placeholders required for this task?
- Are routes and links real?
- Are APIs fully integrated?
- Are validation/auth/RBAC correct?
- Are failure paths handled?
- Did tests actually run?
- Did browser verification actually run?
- Did I update project state?

If any answer is "no" or "unsure," the task is `IN PROGRESS` or `BLOCKED`,
not `COMPLETE`. Fix it or record it — do not report completion anyway.
