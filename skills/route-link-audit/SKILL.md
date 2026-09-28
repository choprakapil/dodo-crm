---
name: route-link-audit
description: "Use before completing any feature that adds or changes navigation, and before final release."
---

# Route & Link Audit

**Purpose:** Trace every navigation action to a real destination and verify protected/public behavior, so no dead links or fake `#` placeholders remain.

## When to use this skill
Use before completing any feature that adds or changes navigation, and before final release.

## Steps
1. List every route, link, button, redirect, and deep link touched by the change.
2. Actually navigate to (or programmatically check) each destination and confirm it resolves correctly, including auth-gated behavior.
3. Update `docs/ROUTE_LINK_REGISTRY.md` with the verified status.

## Evidence required
The list of routes/links checked and the observed result for each, not a general 'looks fine' claim.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
