---
name: api-frontend-contract
description: "Use whenever a frontend component consumes an API endpoint, to keep both sides synchronized."
---

# API/Frontend Contract

**Purpose:** Keep frontend consumers and backend producers synchronized through explicit shared schemas and tests, so a backend change cannot silently break the UI.

## When to use this skill
Use whenever a frontend component consumes an API endpoint, to keep both sides synchronized.

## Steps
1. Identify every frontend call site for the endpoint before changing it (search the codebase, do not assume).
2. Update the shared type/schema in one place and propagate it, rather than hand-maintaining matching shapes in two places.
3. Add or update a test that fails if the frontend and backend shapes diverge.

## Evidence required
List of call sites found by search, and the test output showing the contract test passing.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
