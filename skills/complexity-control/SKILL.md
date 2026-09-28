---
name: complexity-control
description: "Use when designing or reviewing architecture, new abstractions, or new dependencies."
---

# Complexity Control

**Purpose:** Use the smallest architecture that satisfies the requirements. Every abstraction must justify itself.

## When to use this skill
Use when designing or reviewing architecture, new abstractions, or new dependencies.

## Steps
1. Before adding a new layer, pattern, or dependency, state in one sentence what requirement it satisfies that simpler code could not.
2. Prefer direct, readable code over a generic framework built for hypothetical future needs.
3. Flag any module that has grown unusually large or tangled for later simplification.

## Evidence required
The one-sentence justification for any new abstraction, recorded in `docs/DECISION_LOG.md` if non-trivial.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
