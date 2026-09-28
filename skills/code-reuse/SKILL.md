---
name: code-reuse
description: "Use before writing any new function, component, module, or service."
---

# Code Reuse

**Purpose:** Search existing code first. Reuse genuinely shared behavior instead of creating a second implementation of the same thing.

## When to use this skill
Use before writing any new function, component, module, or service.

## Steps
1. Search the codebase and `docs/memory/COMPONENTS.md` for an existing implementation before writing new code.
2. If something similar exists, extend or reuse it rather than duplicating it.
3. Only introduce a new abstraction when the behavior is genuinely shared across more than one caller.

## Evidence required
The search performed (what was searched for) and its result, noted briefly in the task record.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
