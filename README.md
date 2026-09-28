# Antigravity Project Starter Pack V7 — Admin Experience Enhanced

A disciplined operating system for building complete, maintainable
applications with Google Antigravity, with an explicit anti-hallucination
evidence standard and correctly-formatted skills so Antigravity actually
auto-discovers them.

## What it does

It forces a lifecycle of:

**INTAKE → PROJECT NAME → DISCOVERY → QUESTION LOOP → SPECIFICATION → FREEZE → MASTER PLAN → TASK GRAPH → ONE ACTIVE TASK → END-TO-END BUILD → TEST → VERIFY → AUDIT → RECORD → NEXT TASK → RESUME**

It also enforces:
- no coding before discovery;
- end-to-end feature completion;
- persistent session state;
- route/link integrity;
- API-first contracts;
- code reuse and dead-code cleanup;
- simple maintainable architecture;
- security and failure-path checks;
- cross-platform verification;
- an explicit, binding **evidence standard** (`docs/EVIDENCE_STANDARDS.md`) so "done" always means something was actually checked, not just claimed;
- final adversarial audit.
- an explicit **Admin Experience layer** that forces operational workspace design before admin UI implementation;
- workspace-first patterns such as master-detail, contextual drawers, attention queues, drill-downs, activity/history, and justified bulk actions instead of generic card-and-modal CRUD;

## Installation (how Antigravity finds this automatically)

1. Unzip this pack into your project root — `AGENTS.md` must sit at the top level, next to your code.
2. Antigravity reads the root `AGENTS.md` automatically at the start of every session (desktop app and CLI). Nothing else to configure.
3. Everything under `skills/` is auto-discovered too: each `SKILL.md` has a YAML `description` field, and Antigravity uses that description to decide when to pull the full skill in, without you invoking it by name.
4. `agents/`, `docs/`, and `scripts/` are not auto-scanned file-by-file — `AGENTS.md` explicitly tells the agent which of these to open and when, so nothing is left to guessing.
5. If you also use Cursor, Claude Code, or Codex on the same repo, they read this same `AGENTS.md` too — it's a shared cross-tool convention, so this pack works for those as a bonus, not only Antigravity.
6. If you use a project-level `.gemini/GEMINI.md`, note that it takes precedence over `AGENTS.md` if the two conflict — keep it empty or pointing back at `AGENTS.md` unless you intend an Antigravity-only override.

For a new project, tell Antigravity:

> Start this project using the Antigravity Project Operating System. Follow AGENTS.md. Do not code yet.

It should ask for the project name first, then begin discovery.

For an existing project, it should inspect the repository and reconcile the stored state before making changes.

## What changed in V6 + Admin Experience Enhancement

- Added required YAML frontmatter (`name`, `description`) to every `skills/*/SKILL.md` — without this, Antigravity's skill auto-discovery cannot register them; this was a functional gap in V5.
- Added `docs/EVIDENCE_STANDARDS.md`, defining exactly what counts as proof for every "tested" / "verified" / "done" claim in the pack. This is the main defense against an agent asserting something works without checking.
- Added explicit anti-hallucination rules to `AGENTS.md` (never assert unverified facts, never invent APIs/paths, label assumptions, evidence over confident tone).
- Added a `[RULE]` / `[TEMPLATE]` / `[STATE]` / `[AGENT]` / `[SKILL]` tag to every file so it's always clear whether a file is read-only governance, a template to fill in, or live state to keep updating.
- Expanded every `agents/*.md` with a concrete trigger ("invoked when"), a boundary ("must never"), and required evidence output, instead of a one-line description.
- `AGENTS.md` now explicitly instructs the agent not to edit its own governance files during normal feature work, to prevent an agent from quietly loosening its own rules.

## Important

The pack teaches the workflow automatically when placed in the project root. You still need to provide the actual project requirements.

## No false guarantee

No workflow can honestly guarantee zero bugs. This pack is designed to prevent premature completion and force evidence-based verification and recovery — it substantially reduces, but cannot fully eliminate, the risk of an agent asserting something is true or done without having checked.


---

## V8 Admin Product System

For significant admin/internal UI work, the pack now requires Product Intelligence → Admin Experience → Workspace Architecture → Workflow/State → Entity Relationships → Action Architecture → Design System → Implementation → Screenshot QA → UX Regression → final QA.

The purpose is to prevent generic “sidebar + tabs + cards + table + modal” interfaces. Admin work should be designed as an operational workspace with contextual interaction, attention queues, drill-downs, relationship-aware navigation, state-aware actions, activity/history, and justified bulk operations.

Recommended instruction: **“Build this as an operational workspace, not a generic admin page. Read AGENTS.md and run the Admin Product Build Protocol before coding.”**


## V9 — Premium Web Experience & Production Hardening

V9 extends the operating system from admin/product completeness into customer-facing website quality.

It adds:
- bespoke anti-generic art direction;
- scroll-based narrative design without scroll hijacking;
- slow-network and offline resilience;
- 404/403/429/500 and complete failure-state coverage;
- SEO as information architecture;
- robots.txt and sitemap governance;
- image alt-text and media optimization rules;
- lightweight dependency and bundle discipline;
- accessibility and reduced-motion requirements;
- browser/device support matrix;
- safe security/error surfaces;
- analytics/consent governance;
- route-level release readiness.

The objective is not "more effects". The objective is a website that feels custom-designed, expensive, fast, coherent, accessible, searchable, and reliable.


## V10 — Master Plan First / End-to-End Multi-Platform Execution

V10 adds the execution discipline required for large projects:

**Plan the entire product first → freeze architecture/design decisions → break the plan into dependency-aware vertical slices → complete one slice end-to-end → test and verify → document completion → only then recommend the next slice.**

This applies across:
- Next.js public web;
- admin;
- Android;
- iOS;
- backend/API;
- database;
- infrastructure;
- notifications;
- analytics;
- SEO;
- accessibility;
- performance;
- security.

A feature cannot be marked complete while an applicable platform or layer remains half-built.


## V11 — Agentic Engineering System

V11 adds a controlled agent topology designed to reduce blind coding and context waste:

- Repository Cartographer — knows the repository structure and relationships.
- Spectator Verification Agent — independently tries to disprove completion.
- Runtime Observer — verifies actual running behavior.
- Context Curator — minimizes unnecessary context/token usage.
- Change Impact Analyst — predicts affected consumers before edits.
- Plan Integrity Guardian — prevents undocumented scope drift.
- Test Orchestrator — chooses evidence-based test depth.
- Contract Sentinel — catches frontend/API/backend/database/mobile mismatches.

It also adds a `.harness/` project-memory model for repository indexes, phase context, evidence, reviews, and compact handoffs.

The intended loop is:

`MAP → PLAN → BUILD → RUN → SPECTATE → GATE → CLOSE → NEXT`

The builder is never the only judge of success.
