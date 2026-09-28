---
name: typography-check
description: "Use when text looks too dark, too big, too heavy, inconsistent between pages, or when visual hierarchy is unclear. Also use before completing any UI screen."
---

# Typography Check

**Purpose:** Enforce the type scale, weight, color, and line-height rules from
`docs/design/DESIGN_TOKENS.md`. Prevents the most common typography failures:
pure-black body text (too harsh), body text at heading size (no hierarchy),
collapsed line heights (unreadable), and inconsistent font families across surfaces.

## When to use this skill
Use when text looks too dark, too big, too heavy, inconsistent between pages, or when visual hierarchy is unclear. Also use before completing any UI screen.

## Steps

1. **Check body text color.** It must use `text-default` from DESIGN_TOKENS.md.
   It must NOT be pure black (`#000` or `#000000`). Pure black on white has too
   much contrast and causes eye strain.
   ```css
   /* WRONG */ color: #000000;
   /* CORRECT */ color: var(--text-default); /* e.g. #111827 */
   ```

2. **Check secondary/helper text.** It must use `text-muted`. It should be
   noticeably lighter than `text-default` when viewed side by side.

3. **Check heading sizes against the context they appear in:**
   - Full-page hero H1: up to text-5xl ✓
   - Page section H2: text-2xl to text-3xl ✓
   - Card heading: text-lg to text-xl ✓
   - Sidebar nav heading: text-sm (uppercase, tracked) ✓
   - Table column header: text-sm (uppercase, tracked) ✓
   - **A heading larger than text-2xl inside a card or sidebar is almost always wrong.**

4. **Check body text size.** Standard body is `text-base` (16px). Compact UI
   (tables, dense lists) can use `text-sm` (14px). `text-lg` (18px) should only
   appear in introductory paragraphs or feature descriptions — never as default
   body in admin panels.

5. **Check line height.** Any multi-line text must have `leading-normal` (1.5)
   or `leading-relaxed` (1.625). `leading-none` (1.0) on paragraph text causes
   lines to touch — never use it on readable prose.

6. **Check font weight hierarchy.** There must be visible contrast between
   headings and body. If heading and body are both font-normal (400), there is
   no hierarchy. Heading should be font-semibold (600) or font-bold (700).

7. **Check font family.** Every surface (web, admin, CMS, iOS, Android) must
   use `font-sans` from DESIGN_TOKENS.md. If the admin panel is using
   `system-ui` and the homepage uses Inter, they are inconsistent — fix the
   admin panel.

8. **Check letter spacing on uppercase labels.** Any small, uppercase label
   (e.g. "SETTINGS", "STATUS") should use `tracking-wide` to aid readability.
   Standard body copy should use `tracking-normal` — never `tracking-wide` on
   paragraph text (makes it hard to read at length).

## Common Failures & Fixes

```
FAIL: color: #000000 on body text
FIX:  color: var(--text-default)

FAIL: font-size: 18px as default body in admin table
FIX:  font-size: var(--text-sm) (14px) for compact data tables

FAIL: H2 with font-size: 30px inside a 200px sidebar
FIX:  font-size: var(--text-lg) with font-weight: 600 in sidebar context

FAIL: line-height: 1 on a <p> block of text
FIX:  line-height: var(--leading-normal) (1.5)

FAIL: Admin panel uses Arial, homepage uses Inter
FIX:  Admin panel CSS: font-family: var(--font-sans) (which is Inter)
```

## Evidence required
A list of each typography issue found and its fix (or "no issues found"), plus
the specific file/component where the check was run. See `docs/EVIDENCE_STANDARDS.md`.

Do not mark work that uses this skill as complete without the evidence above.
