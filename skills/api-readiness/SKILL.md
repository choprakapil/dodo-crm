---
name: api-readiness
description: "Use before marking any API endpoint as done, to confirm it is actually usable and not a partial stub."
---

# API Readiness

**Purpose:** No required API may be silently deferred as 'later'. Contract, implementation, validation, auth, tests, integration, and documentation must all align before an API counts as ready.

## When to use this skill
Use before marking any API endpoint as done, to confirm it is actually usable and not a partial stub.

## Steps
1. Confirm the endpoint matches its written contract exactly (method, route, schema, status codes).
2. Confirm auth/RBAC, input validation, and error handling are implemented, not just the happy path.
3. Confirm the frontend (or other real consumer) actually calls it successfully.
4. Confirm a realistic test exists and passes.

## Evidence required
Test run output for this endpoint, plus a note of which real consumer was verified against it.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
