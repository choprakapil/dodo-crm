---
name: icon-usage-check
description: "Use whenever icons are added to any UI, or when icons look too large, overlap text, or feel visually disconnected from their labels."
---

# Icon Usage Check

**Purpose:** Icons enhance clarity when used correctly and destroy it when used
carelessly. This skill prevents the four most common icon failures: wrong size
relative to sibling text, missing gap between icon and label, mismatched color,
and positional overlap on content.

## When to use this skill
Use whenever icons are added to any UI, or when icons look too large, overlap text, or feel visually disconnected from their labels.

## Steps

1. **Check icon size matches its context.** Read the icon sizes from
   `docs/design/DESIGN_TOKENS.md` and apply:

   | Context | Size to use |
   |---|---|
   | Inside a paragraph / body text | `icon-sm` (16px) |
   | Inside a button with a label | `icon-md` (20px) |
   | Navigation link | `icon-md` (20px) |
   | Section heading | `icon-lg` (24px) |
   | Feature card illustration | `icon-xl` (32px) or `icon-2xl` (48px) |
   | Empty state illustration | `icon-2xl` (48px) |

   If an icon is larger than the text next to it by more than 4px, it is almost
   certainly the wrong size.

2. **Check gap between icon and its label.** Every icon-label pair must have
   explicit gap — minimum `icon-gap` (8px, `gap-2`). Never use `gap-0`.
   ```jsx
   // WRONG — icon touches label
   <div className="flex"><Icon size={20} /><span>Dashboard</span></div>

   // CORRECT — 8px gap
   <div className="flex items-center gap-2"><Icon size={20} /><span>Dashboard</span></div>
   ```

3. **Check vertical alignment.** The icon must be vertically centered with its
   sibling text. Use `items-center` on the flex parent. Never let an icon float
   above or below the text midpoint.

4. **Check icon color matches sibling text.** If the label is `text-muted`, the
   icon must also be `text-muted`. If the label is `text-default`, the icon must
   also be `text-default`. An icon that is a different color to its label looks
   like a design mistake.
   ```jsx
   // WRONG — icon is primary blue, label is muted grey
   <HomeIcon className="text-primary" /><span className="text-muted">Home</span>

   // CORRECT — both muted
   <HomeIcon className="text-muted" /><span className="text-muted">Home</span>
   ```

5. **Check for positional overlap.** If any icon uses `position: absolute` or
   `position: fixed`, verify its z-index and location do not place it over
   readable text. Scroll through the layout and confirm no icon is sitting on
   top of content at any viewport width.

6. **Check interactive icons have accessible labels.** Any icon used alone
   (without visible text) on a button or link must have `aria-label` or a
   visually-hidden sibling span.

7. **Check stroke width** (Lucide icons): use `strokeWidth={1.5}` at small
   sizes (16–20px). Default `strokeWidth={2}` looks too heavy and blocky at
   small sizes in dense UIs like admin panels and sidebars.

## Evidence required
A list of icon-label pairs checked, their sizes confirmed, and any overlap or
mismatch issues found and fixed. See `docs/EVIDENCE_STANDARDS.md`.

Do not mark work that uses this skill as complete without the evidence above.
