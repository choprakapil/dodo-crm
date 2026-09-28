[STATE]

# Design Tokens

**Single source of truth for all visual values.** Every surface (web, admin,
CMS, iOS, Android) reads from this file. No hardcoded color, font, spacing, or
radius value is allowed anywhere in the project that is not traced back to a
token here.

**How to use:**
- Web/Admin/CMS: Map these to CSS variables or Tailwind theme extension
- iOS: Map to SwiftUI Color/Font/Spacing constants in `DesignTokens.swift`
- Android: Map to `res/values/colors.xml`, `res/values/dimens.xml`, Material theme

**Source:** Extracted from homepage by `agents/design-system-extractor.md`.
Do not edit manually — re-run the extractor if the homepage changes.

**Last extracted:** [DATE]
**Extracted from:** [FILE PATHS]

---

## Colors

### Brand Colors
```
primary:           [e.g. #2563EB]   /* source: [file:line] */
primary-hover:     [e.g. #1D4ED8]   /* source: [file:line] */
primary-light:     [e.g. #DBEAFE]   /* source: [file:line] */
secondary:         [e.g. #7C3AED]   /* source: [file:line] */
secondary-hover:   [e.g. #6D28D9]   /* source: [file:line] */
secondary-light:   [e.g. #EDE9FE]   /* source: [file:line] */
accent:            [e.g. #F59E0B]   /* source: [file:line] */
```

### Backgrounds
```
bg-base:           [e.g. #FFFFFF]   /* main page background */
bg-surface:        [e.g. #F9FAFB]   /* card / panel background */
bg-surface-raised: [e.g. #FFFFFF]   /* elevated card (modal, dropdown) */
bg-overlay:        [e.g. #0000007A] /* modal backdrop */
bg-inverse:        [e.g. #111827]   /* dark section / footer */
```

### Text
```
text-default:      [e.g. #111827]   /* body text */
text-muted:        [e.g. #6B7280]   /* secondary / helper text */
text-disabled:     [e.g. #9CA3AF]   /* disabled state */
text-inverse:      [e.g. #FFFFFF]   /* text on dark backgrounds */
text-link:         [e.g. #2563EB]   /* hyperlinks */
text-link-hover:   [e.g. #1D4ED8]
```

### Borders
```
border-default:    [e.g. #E5E7EB]   /* standard dividers */
border-strong:     [e.g. #9CA3AF]   /* focused / selected borders */
border-error:      [e.g. #EF4444]   /* validation errors */
```

### Status / Semantic
```
color-success:     [e.g. #10B981]
color-success-bg:  [e.g. #ECFDF5]
color-warning:     [e.g. #F59E0B]
color-warning-bg:  [e.g. #FFFBEB]
color-error:       [e.g. #EF4444]
color-error-bg:    [e.g. #FEF2F2]
color-info:        [e.g. #3B82F6]
color-info-bg:     [e.g. #EFF6FF]
```

---

## Typography

### Font Families
```
font-sans:    [e.g. 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif]
font-mono:    [e.g. 'JetBrains Mono', 'Fira Code', monospace]
font-display: [e.g. 'Cal Sans', 'Inter', sans-serif]  /* headings only, if different */
```

### Type Scale (all values in rem, base 16px)
```
text-xs:   [e.g. 0.75rem  / 12px]  line-height: [e.g. 1rem    / 16px]
text-sm:   [e.g. 0.875rem / 14px]  line-height: [e.g. 1.25rem / 20px]
text-base: [e.g. 1rem     / 16px]  line-height: [e.g. 1.5rem  / 24px]  ← body default
text-lg:   [e.g. 1.125rem / 18px]  line-height: [e.g. 1.75rem / 28px]
text-xl:   [e.g. 1.25rem  / 20px]  line-height: [e.g. 1.75rem / 28px]
text-2xl:  [e.g. 1.5rem   / 24px]  line-height: [e.g. 2rem    / 32px]
text-3xl:  [e.g. 1.875rem / 30px]  line-height: [e.g. 2.25rem / 36px]
text-4xl:  [e.g. 2.25rem  / 36px]  line-height: [e.g. 2.5rem  / 40px]
text-5xl:  [e.g. 3rem     / 48px]  line-height: [e.g. 1]
```

### Font Weights
```
font-normal:   400   /* body text */
font-medium:   500   /* labels, buttons */
font-semibold: 600   /* subheadings, emphasis */
font-bold:     700   /* headings */
```

### Letter Spacing
```
tracking-tight:  [e.g. -0.025em]  /* large headings */
tracking-normal: [e.g.  0em]      /* body */
tracking-wide:   [e.g.  0.025em]  /* uppercase labels */
```

---

## Spacing

**Base unit:** [e.g. 4px]

All spacing must come from this scale. Do not use arbitrary values.

```
space-0:   0px
space-1:   [e.g.  4px]
space-2:   [e.g.  8px]
space-3:   [e.g. 12px]
space-4:   [e.g. 16px]   ← standard internal padding
space-5:   [e.g. 20px]
space-6:   [e.g. 24px]   ← standard section gap
space-8:   [e.g. 32px]
space-10:  [e.g. 40px]
space-12:  [e.g. 48px]
space-16:  [e.g. 64px]   ← section vertical padding
space-20:  [e.g. 80px]
space-24:  [e.g. 96px]
```

### Named Spacing (semantic)
```
component-padding-x:   [e.g. space-4 / 16px]   /* inside cards, panels */
component-padding-y:   [e.g. space-3 / 12px]
section-gap:           [e.g. space-6 / 24px]    /* between sibling sections */
page-margin-x:         [e.g. space-6 / 24px]    /* mobile page side padding */
page-margin-x-md:      [e.g. space-8 / 32px]    /* tablet */
page-margin-x-lg:      [e.g. space-16/ 64px]    /* desktop */
icon-gap:              [e.g. space-2 /  8px]    /* gap between icon and label */
form-field-gap:        [e.g. space-4 / 16px]    /* between form fields */
```

---

## Borders

### Border Radius
```
radius-none:  0
radius-sm:    [e.g. 4px]    /* inputs, small badges */
radius-md:    [e.g. 8px]    /* cards, buttons */
radius-lg:    [e.g. 12px]   /* modals, large cards */
radius-xl:    [e.g. 16px]   /* feature sections */
radius-full:  9999px        /* pills, avatars */
```

### Border Width
```
border-width-default: [e.g. 1px]
border-width-thick:   [e.g. 2px]   /* focused inputs, selected state */
```

---

## Shadows

```
shadow-sm:  [e.g. 0 1px 2px rgba(0,0,0,0.05)]
shadow-md:  [e.g. 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)]
shadow-lg:  [e.g. 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)]
shadow-xl:  [e.g. 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)]
shadow-inner: [e.g. inset 0 2px 4px rgba(0,0,0,0.06)]
```

---

## Icons

### Icon Set
```
library:  [e.g. Lucide React / Heroicons / Material Icons]
import:   [e.g. import { Home } from 'lucide-react']
```

### Icon Sizes
```
icon-xs:  [e.g. 12px]  /* tiny badge indicators */
icon-sm:  [e.g. 16px]  /* inline text (body size) */
icon-md:  [e.g. 20px]  /* buttons, labels (default) */
icon-lg:  [e.g. 24px]  /* navigation, headings */
icon-xl:  [e.g. 32px]  /* feature icons, empty states */
icon-2xl: [e.g. 48px]  /* hero / illustration icons */
```

### Icon Rules
```
RULE: icon-sm (16px) inside body text — never larger (blocks reading)
RULE: icon-md (20px) inside buttons — paired with button label
RULE: always add gap-2 (8px) between icon and text — never 0
RULE: never use icon alone without aria-label on interactive elements
RULE: icon color must always match sibling text color — never a different color
RULE: use stroke-width="1.5" for Lucide; "2" looks too heavy at small sizes
```

---

## Motion

```
duration-fast:   [e.g. 100ms]   /* micro-interactions (button press) */
duration-normal: [e.g. 150ms]   /* standard transitions (hover) */
duration-slow:   [e.g. 300ms]   /* page transitions, modals */
easing-default:  [e.g. cubic-bezier(0.4, 0, 0.2, 1)]  /* standard */
easing-in:       [e.g. cubic-bezier(0.4, 0, 1, 1)]     /* exit */
easing-out:      [e.g. cubic-bezier(0, 0, 0.2, 1)]     /* enter */
```

---

## Breakpoints

```
sm:  [e.g. 640px]
md:  [e.g. 768px]
lg:  [e.g. 1024px]
xl:  [e.g. 1280px]
2xl: [e.g. 1536px]
```

---

## Z-Index Scale

```
z-base:    0
z-raised:  10    /* cards, dropdowns */
z-overlay: 100   /* modals, sidebars */
z-toast:   200   /* notifications */
z-tooltip: 300   /* tooltips */
```

---

## CSS Variable Output (Web)

After filling in values above, generate this block for `src/styles/tokens.css`:

```css
:root {
  /* Colors */
  --color-primary:        [value];
  --color-primary-hover:  [value];
  /* ... all tokens ... */

  /* Typography */
  --font-sans:            [value];
  --font-size-base:       [value];
  /* ... */

  /* Spacing */
  --space-1: [value];
  --space-2: [value];
  /* ... */

  /* Borders */
  --radius-sm: [value];
  --radius-md: [value];
  /* ... */
}
```

---

## iOS Swift Constants Output

```swift
// DesignTokens.swift
extension Color {
    static let primary = Color(hex: "[value]")
    static let bgSurface = Color(hex: "[value]")
    // ...
}
extension Font {
    static let bodyDefault = Font.custom("[font-name]", size: 16)
    // ...
}
struct Spacing {
    static let componentPaddingX: CGFloat = [value]
    // ...
}
```

---

## Android Resources Output

```xml
<!-- res/values/colors.xml -->
<resources>
    <color name="colorPrimary">[value]</color>
    <color name="bgSurface">[value]</color>
    <!-- ... -->
</resources>

<!-- res/values/dimens.xml -->
<resources>
    <dimen name="componentPaddingX">[value]dp</dimen>
    <!-- ... -->
</resources>
```
