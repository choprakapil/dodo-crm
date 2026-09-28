---
name: security-gate
description: "Use for any change touching authentication, authorization, user input, secrets, or sensitive data."
---

# Security Gate

**Purpose:** Verify auth, RBAC, validation, secrets handling, rate limits, data exposure, and abuse cases before a feature can be marked done.

## When to use this skill
Use for any change touching authentication, authorization, user input, secrets, or sensitive data.

## Steps
1. Confirm the endpoint/page enforces the correct authentication and role checks — actually test with an unauthorized identity, don't assume.
2. Confirm all external input is validated server-side, not only in the UI.
3. Confirm no secrets or sensitive data appear in logs, responses, or client-side code.

## Evidence required
The specific unauthorized/invalid-input case tested and its observed result, recorded in `docs/memory/SECURITY_STATE.md`.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
