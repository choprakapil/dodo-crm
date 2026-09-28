---
name: cross-surface-consistency
description: "Use when admin panel, CMS, iOS app, or Android app is being built or reviewed, to ensure it visually matches the main website/homepage."
---

# Cross-Surface Consistency

**Purpose:** The admin panel, CMS, and mobile apps must feel like they belong
to the same product as the homepage — same brand color, same font, same spacing
language, same component shapes. When each surface picks its own values, the
product feels fragmented and unprofessional.

## When to use this skill
Use when admin panel, CMS, iOS app, or Android app is being built or reviewed, to ensure it visually matches the main website/homepage.

## Steps

1. **Confirm `docs/design/DESIGN_TOKENS.md` is filled in.** If not, stop and
   run `agents/design-system-extractor.md` first.

2. **Open both the homepage and the surface being reviewed side by side.** This
   can be two browser tabs, or a screenshot of the homepage next to the new
   surface. You are looking for visible differences.

3. **Check these 6 values match exactly:**

   | Token | Homepage value | This surface's value | Match? |
   |---|---|---|---|
   | Primary color (button/link) | read from DESIGN_TOKENS | read from this surface's CSS | ✓/✗ |
   | Background color | read from DESIGN_TOKENS | read from this surface's CSS | ✓/✗ |
   | Font family (body) | read from DESIGN_TOKENS | read from this surface's CSS | ✓/✗ |
   | Card border radius | read from DESIGN_TOKENS | read from this surface's CSS | ✓/✗ |
   | Default border color | read from DESIGN_TOKENS | read from this surface's CSS | ✓/✗ |
   | Error color (form validation) | read from DESIGN_TOKENS | read from this surface's CSS | ✓/✗ |

4. **Check the icon set is the same.** If the homepage uses Lucide React, the
   admin panel and apps must also use Lucide (or the closest equivalent for
   native mobile). Never mix icon sets across surfaces (e.g. Heroicons on web +
   Material icons on admin panel).

5. **Check that admin-specific UI (tables, sidebars, stat cards, log viewers)
   uses semantic variants of the same tokens**, not new values:
   - Sidebar background: `bg-surface` (slightly off-white/dark) — not a random grey
   - Table header: `bg-surface` with `border-default` — not a random blue
   - Stat card: `bg-surface-raised` with `shadow-sm` — not custom shadow

6. **For iOS and Android:** confirm the app's primary color, font family, and
   card shape match the web. Also confirm the icon set is visually consistent
   (even if different libraries are used for technical reasons, the icons should
   look like they belong to the same family).

7. **Document any deliberate divergences** in `docs/DECISION_LOG.md`. For
   example: "Admin panel sidebar uses `bg-inverse` (dark) intentionally, as a
   visual signal it is a privileged surface." This is fine — but it must be a
   documented decision, not an accident.

## Evidence required
The filled-in 6-row table above with ✓/✗ for each match, a note of any
deliberate divergences and where they're logged, and a note in
`docs/memory/DESIGN_STATE.md`. See `docs/EVIDENCE_STANDARDS.md`.

Do not mark work that uses this skill as complete without the evidence above.
