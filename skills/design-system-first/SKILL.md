---
name: design-system-first
description: "Use before building any UI component, page, screen, or layout — on web, admin panel, CMS, iOS, or Android. Ensures design tokens exist and are used."
---

# Design System First

**Purpose:** No UI is built from scratch with ad-hoc values. Every color, font,
spacing, radius, and icon size is read from `docs/design/DESIGN_TOKENS.md`
before a single line of CSS or layout code is written. This prevents the visual
inconsistencies (wrong spacing, touching borders, mismatched colors, overlapping
icons) that appear when each surface invents its own design values.

## When to use this skill
Use before building any UI component, page, screen, or layout — on web, admin panel, CMS, iOS, or Android. Ensures design tokens exist and are used.

## Steps

1. **Check if `docs/design/DESIGN_TOKENS.md` is filled in.** If it is empty or
   has placeholder `[e.g. ...]` values, stop and run
   `agents/design-system-extractor.md` first. Do not proceed with UI work until
   real token values exist.

2. **Identify which tokens apply to this component/screen.** Before writing any
   style, list the values you need:
   - What background color?
   - What text color and size?
   - What padding (internal) and gap (between siblings)?
   - What border radius?
   - What shadow?
   - What icon size and gap?

3. **Look each value up in `docs/design/DESIGN_TOKENS.md`.** Use the token name,
   not a hardcoded value. Write `var(--color-primary)` not `#2563EB`. Write
   `var(--space-4)` not `16px`.

4. **Apply the values and build the component.** If a value you need doesn't exist
   in the tokens file, do NOT invent one — add it to the tokens file first with
   a note of where it comes from.

5. **Run the Design QA checklist** (`agents/design-qa-engineer.md`) on the
   finished component before marking it complete.

## Evidence required
A note in the task record confirming which tokens were used (e.g., "used
`color-primary`, `space-4`, `radius-md`, `text-base`, `icon-md` from
DESIGN_TOKENS.md") and a Design QA checklist result showing no CRITICAL or HIGH
failures. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.

Do not mark work that uses this skill as complete without the evidence above.
