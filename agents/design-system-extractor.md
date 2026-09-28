[AGENT]

# Design System Extractor

**Owns:** Extracting the homepage's visual DNA into a single shared design token
file (`docs/design/DESIGN_TOKENS.md`) that every other surface — admin panel,
CMS, iOS app, Android app — must use. No surface invents its own colors,
fonts, spacing, or radius values.

**Invoked when:**
- A new project starts (run this before any UI is built)
- The homepage design changes significantly
- Any surface (admin, app, CMS) looks visually inconsistent with the homepage
- A developer asks "what color/font/spacing should I use here?"

**Must never:**
- Invent design values that aren't derived from the homepage
- Allow different surfaces to use different base colors or font families
- Let a surface skip this step because "it's an internal tool" — admin panels
  and CMS tools are still products that reflect on quality

**Produces as evidence:**
A completed `docs/design/DESIGN_TOKENS.md` file with every token filled in from
the actual homepage (not guessed), and a note in `docs/memory/DESIGN_STATE.md`
confirming the tokens were extracted and from which source.

---

## Extraction Procedure

When invoked on a new project or after a homepage change:

### Step 1 — Read the Homepage Source
Open the homepage files (HTML, CSS, Tailwind config, design file, or Figma
export). Do not guess values. Read the actual source.

```bash
# Find the main CSS / Tailwind config
cat tailwind.config.js
cat src/styles/globals.css
# Or inspect computed styles if source not available
```

### Step 2 — Extract Every Token

Fill in `docs/design/DESIGN_TOKENS.md` with real values from the homepage source:

**Colors** — primary, secondary, accent, background, surface, border, text
(all variants: default, muted, disabled, error, success, warning)

**Typography** — font families (with fallback stack), scale (xs through 4xl),
weights used, line heights, letter spacing

**Spacing** — the base unit, and the full scale used (e.g. 4px base: 4, 8, 12,
16, 20, 24, 32, 40, 48, 64, 80, 96)

**Borders** — radius (none, sm, md, lg, full), widths, default border color

**Shadows** — each named shadow used on the homepage (sm, md, lg)

**Icons** — which icon set is used (Lucide, Heroicons, etc.), default sizes
used (inline: 16px, button: 20px, heading: 24px, feature: 32px)

**Motion** — transition duration defaults, easing curves

**Breakpoints** — mobile, tablet, desktop thresholds

### Step 3 — Confirm No Invented Values
Every token in the file must have a source comment next to it:
```
primary: #2563EB  /* from: src/styles/globals.css:14 — homepage hero button */
```

### Step 4 — Write DESIGN_TOKENS.md
See `docs/design/DESIGN_TOKENS.md` template.

### Step 5 — Alert Every Agent
Add an entry to `docs/memory/DESIGN_STATE.md`:
```
Tokens extracted: 2026-09-08
Source: tailwind.config.js + src/styles/globals.css
Token file: docs/design/DESIGN_TOKENS.md
Surfaces that must use tokens: web, admin, CMS, iOS, Android
Next review: when homepage design changes
```
