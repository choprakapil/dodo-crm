---
name: spacing-layout-check
description: "Use when any layout looks cramped, sections are touching, content has no breathing room, or padding feels inconsistent. Also use before finalizing any page layout."
---

# Spacing & Layout Check

**Purpose:** Enforce the spacing system from `docs/design/DESIGN_TOKENS.md` so
no two sections touch, no content is flush with a container edge, and no list
collapses into a wall of text. Spacing is the single most common cause of
layouts feeling "broken" even when colors and fonts are correct.

## When to use this skill
Use when any layout looks cramped, sections are touching, content has no breathing room, or padding feels inconsistent. Also use before finalizing any page layout.

## Steps

1. **Identify every container in the component/screen:** page, section, card,
   panel, sidebar, list, form, table row, modal.

2. **For each container, verify it has internal padding:**
   - Section/page blocks: `space-16` (64px) top/bottom, `page-margin-x` sides
   - Cards/panels: `component-padding-x` on all sides (minimum `space-4` / 16px)
   - Sidebar: `space-4` internal padding; nav links are not flush with edges
   - Table rows: `space-3` (12px) top/bottom per row
   - Form fields: `form-field-gap` (16px) between each field

3. **For each group of siblings, verify there is gap between them:**
   - List items: minimum `space-3` (12px) gap
   - Cards in a grid: minimum `space-4` (16px) gap
   - Buttons in a group: minimum `space-2` (8px) gap
   - Badges next to each other: minimum `space-2` (8px) gap

4. **Check that no adjacent sections share a border line without padding.**
   If section A ends and section B starts immediately, add `space-16` padding
   or a deliberate visual separator (a border or background color change).

5. **Check mobile:** At the smallest breakpoint (`sm`), content must still have
   `page-margin-x` side padding. Nothing touches the device edge.

6. **Run a visual scan** — scroll through the entire screen slowly and look for:
   - Any text that appears to touch a containing border
   - Any two sections that blend together without a clear visual separation
   - Any list where items look like a single block of text
   - Any form where labels and inputs appear to be overlapping

## Evidence required
A list of the containers checked, their padding values verified, and a
visual scan outcome ("no touching borders found" or "[specific problem fixed]
at [component/location]"). See `docs/EVIDENCE_STANDARDS.md`.

Do not mark work that uses this skill as complete without the evidence above.
