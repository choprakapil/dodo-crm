[RULE]

# Premium Bespoke Website Design System

## 1. Design Target

The target is a premium, custom-built website that feels art-directed and brand-specific rather than generated from a UI template.

"Premium" means:
- strong visual authorship;
- deliberate typography;
- memorable composition;
- restrained but meaningful motion;
- excellent spacing and rhythm;
- high-quality imagery;
- clear information hierarchy;
- fast interaction;
- polished edge states;
- no visual dependency on gradients, generic dashboards, or repetitive cards.

This is a design direction, not a literal price claim.

## 2. Anti-Generic Rules

Avoid by default:
- gradient blobs behind every hero;
- glassmorphism everywhere;
- repeated 3-column cards;
- identical rounded rectangles for every content block;
- oversized "AI" typography with no semantic purpose;
- stock illustrations used as decoration;
- generic floating buttons;
- random animated counters;
- excessive shadows;
- excessive border radii;
- scroll-jacking;
- animation on every element;
- template-like section repetition.

## 3. Composition Vocabulary

Use a controlled mix of:
- editorial full-bleed sections;
- asymmetric 12-column grids;
- split compositions;
- oversized type paired with small metadata;
- edge-to-edge media;
- cropped image compositions;
- intentional overlaps;
- sticky narrative columns;
- horizontal/vertical rhythm changes;
- visual anchors;
- numbered chapters;
- framed media;
- typographic dividers;
- large negative space;
- compact utility areas.

A section should have a reason to exist. Avoid "section + heading + paragraph + cards" as the default pattern.

## 4. Scroll Narrative

Each major route defines a scroll story:
1. arrival;
2. orientation;
3. proof/context;
4. exploration;
5. detail;
6. decision/action;
7. closing/re-entry.

Scroll effects must reinforce that story.

Preferred techniques:
- staggered text/media reveals;
- image crop transitions;
- scale within a masked frame;
- sticky chapter navigation;
- progress indicators;
- subtle depth movement;
- content replacement inside a stable frame;
- horizontal sequences only where they genuinely improve storytelling.

## 5. Motion Tokens

Define:
- duration-fast;
- duration-standard;
- duration-slow;
- easing-enter;
- easing-exit;
- easing-emphasis;
- distance-small;
- distance-medium;
- reduced-motion fallback.

Never animate layout-heavy properties when transform/opacity can express the same result.

## 6. Responsive Art Direction

Do not merely stack desktop columns.

Define separately:
- mobile composition;
- tablet composition;
- desktop composition;
- wide-screen composition.

A mobile design may reorder, crop, simplify, or remove decorative motion while preserving the same information hierarchy.

## 7. Component Philosophy

Components should be reusable by behavior, not visually repetitive.

Examples:
- `RevealBlock`
- `MediaFrame`
- `ChapterNav`
- `EditorialSplit`
- `MetricStory`
- `QuoteBlock`
- `ImageSequence`
- `ActionRail`
- `StatusMessage`

A component may have variants, but variants must remain visually coherent.

## 8. Design QA

Before approval inspect:
- typography;
- grid alignment;
- optical spacing;
- baseline rhythm;
- image crops;
- responsive composition;
- hover/focus states;
- reduced motion;
- loading states;
- error states;
- empty states;
- contrast;
- touch targets;
- scroll behavior;
- visual density.

The screenshot must look intentional even if all animation is frozen.
