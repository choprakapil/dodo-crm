---
name: failure-path
description: "Use when implementing or reviewing any critical operation (payments, auth, external calls, writes)."
---

# Failure Path

**Purpose:** Design critical failures explicitly and test recovery, retries, idempotency, and user-visible error behavior — not only the happy path.

## When to use this skill
Use when implementing or reviewing any critical operation (payments, auth, external calls, writes).

## Steps
1. For each critical operation, write down what can fail (timeout, bad input, partial failure, duplicate request).
2. Implement the corresponding retry/rollback/user-facing error behavior.
3. Actually trigger at least one failure case and confirm the system behaves as designed.

## Evidence required
The specific failure case triggered and the observed system behavior (error message, retry, rollback).

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
