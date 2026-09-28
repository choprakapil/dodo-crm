---
name: admin-experience-first
description: "Use before building or significantly redesigning an admin panel, internal tool, operations workspace, moderation queue, fleet workspace, booking workspace, verification queue, CMS workspace, or staff/RBAC workspace. Prevents generic card-and-modal CRUD by defining the operational workflow, information hierarchy, states, contextual actions, and workspace structure first."
---

# Admin Experience First

**Purpose:** Ensure admin UI is designed as an operational product/workspace, not as a generic collection of pages, cards, tabs, tables, and modals.

## When to use this skill

Use before implementing or significantly redesigning any admin/internal workspace.

## Required sequence

### 1. Identify the administrator job

Write one sentence describing the primary job the administrator must complete on this screen.

### 2. Map entities

List the entities involved and their relationships. Examples include:

Customer → Booking → Vehicle → Hub → KYC → Payment → Handover → Trip

Only use relationships that actually exist in the project.

### 3. Define information hierarchy

Classify information as:

- immediate scan;
- secondary context;
- deep detail;
- historical/audit information.

The default workspace must expose what administrators need most frequently.

### 4. Choose the workspace pattern

Select the simplest pattern that supports the workflow:

- table/list;
- compact metric + table;
- master-detail;
- queue;
- timeline;
- dashboard + attention queue;
- another justified pattern.

Do not default to card grids.

### 5. Define interaction placement

For each important action, explicitly choose:

- inline;
- contextual drawer;
- focused modal;
- dedicated route.

Explain why.

### 6. Define operational controls

Decide whether the workspace needs:

- search;
- filters;
- sorting;
- segments/tabs;
- saved views;
- bulk selection/actions;
- contextual actions;
- drill-down links.

Do not add controls without a real workflow reason.

### 7. Define states

At minimum consider:

- loading;
- default;
- empty;
- filtered empty;
- error;
- selected;
- editing;
- saving;
- success;
- action failure;
- destructive confirmation.

Add domain-specific states when relevant.

### 8. Define attention model

Identify what requires administrator attention and how it appears:

- alert;
- queue;
- badge;
- count;
- highlighted row;
- dashboard drill-down.

Do not use attention colors merely for decoration.

### 9. Apply the design system

After the experience architecture is defined, run `skills/design-system-first/SKILL.md` and apply the project's design tokens.

### 10. Run UX and design QA

Run:

- `agents/ux-architect.md`
- `agents/design-qa-engineer.md`
- this skill's productivity test

## Productivity test

Before marking the workspace ready, answer:

1. Can the administrator identify the primary work immediately?
2. Can they scan the important records without opening each record?
3. Can they inspect context without unnecessarily leaving the workspace?
4. Are common actions faster than uncommon actions?
5. Are risky actions appropriately protected?
6. Are empty/loading/error/success states clear?
7. Are related entities connected where useful?
8. Does the layout remain usable at the supported viewport sizes?

If any answer is no, revise the workspace architecture before calling the UI complete.

## Evidence required

Record a short Admin Workspace Brief containing:

- primary job;
- information hierarchy;
- workspace pattern;
- entities/relationships;
- action placement;
- filters/search/sorting;
- bulk operations decision;
- state matrix;
- attention model;
- responsive strategy.

Do not mark the admin workspace complete without this evidence and Design QA.
