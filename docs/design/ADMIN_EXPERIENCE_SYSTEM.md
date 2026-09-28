[RULE]

# PrimeRides Admin Experience System

## Purpose

This document defines how internal/admin interfaces should behave as products. It complements `docs/design/DESIGN_TOKENS.md`, which defines how surfaces look.

## Product principle

A professional admin panel is an **operational workspace**, not a set of marketing cards and CRUD modals.

Visual polish is necessary but not sufficient. The interface must help an administrator:

1. understand what needs attention;
2. scan important information quickly;
3. inspect context without unnecessary navigation;
4. perform frequent actions efficiently;
5. understand the result of an action;
6. move between related entities when useful.

## Workspace vocabulary

Prefer these concepts when they fit the workflow:

- **Command center:** overview + actionable attention queues + drill-down.
- **Operations workspace:** filters/search + dense list/table + contextual actions.
- **Verification queue:** records awaiting review with focused inspection.
- **Master-detail:** scan records on one side, inspect selected context on the other.
- **Contextual drawer:** inspect or perform related work while retaining page context.
- **Focused modal:** a deliberate decision or compact form.
- **Activity timeline:** meaningful operational history.
- **Drill-down:** a metric or alert leads to a filtered workspace.

## Default hierarchy

For most operational screens:

1. Page context
2. Compact metrics or attention summary when useful
3. Search/filter/action toolbar
4. Primary workspace (usually table/list/queue)
5. Contextual detail
6. Activity/history where useful

This is guidance, not a requirement to add every layer.

## Card discipline

Cards are allowed for genuine grouping, but do not use cards as the default container for every record.

Avoid:

- three-column vehicle marketing cards in operational fleet management;
- large KYC document cards as a verification queue;
- permanent large forms beside list data when creation is occasional;
- KPI cards that consume more space than the work they summarize;
- nested card-inside-card structures without a clear information hierarchy.

## Modal and drawer discipline

Use:

- inline actions for simple frequent operations;
- drawers for contextual inspection and related actions;
- modals for focused decisions/forms;
- dedicated routes for substantial workflows or deep-linkable records.

Never use a modal simply because it is technically convenient.

## Action hierarchy

Primary actions should be visually strongest.
Secondary actions should remain available without competing with primary work.
Tertiary actions should stay quiet.
Destructive actions require appropriate safeguards and auditability.

## States

Every workspace must account for relevant:

- loading;
- empty;
- filtered empty;
- error;
- selected;
- editing;
- saving;
- success;
- failure;
- destructive confirmation;
- domain-specific states.

## Entity relationships

Where the product contains related entities, the UI should make useful relationships discoverable rather than treating every route as an isolated island.

Examples, only when supported by the product:

Customer ↔ Booking ↔ Vehicle ↔ Hub
Booking ↔ KYC ↔ Payment ↔ Handover ↔ Trip

## Attention model

Use alerts, queues, counts, badges, row emphasis, and drill-downs to communicate work that needs attention. Semantic color must represent meaning, not decoration.

## Productivity requirement

A technically complete screen that forces unnecessary scrolling, navigation, or repeated modal opening is considered an experience defect even if all required CRUD controls are present.

## Relationship to design system

This document governs **what the admin experience should do and how it should be organized**.

`docs/design/DESIGN_TOKENS.md` governs **visual values**.

`agents/design-qa-engineer.md` verifies visual quality.

`agents/admin-engineer.md` verifies admin workflow, permissions, and auditability.
