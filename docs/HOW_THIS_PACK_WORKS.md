[RULE]

# How This Pack Works

## 1. What Antigravity knows automatically

When these files are in the project root, `AGENTS.md` provides the governing instructions. The supporting docs, agents, skills, and memory files provide the operating procedure and persistent project state.

You should not need to repeatedly explain:
- discovery-first development;
- task chunking;
- end-to-end completion;
- session continuity;
- code reuse;
- route/link auditing;
- API readiness;
- security gates;
- final verification.

## 1A. Admin experience work

For admin/internal UI, the pack now adds a product-experience layer before visual implementation. Antigravity should consult `agents/admin-experience-architect.md`, run `skills/admin-experience-first/SKILL.md`, and use `docs/design/ADMIN_EXPERIENCE_SYSTEM.md`. This prevents a common failure mode where an AI produces a technically complete but generic "sidebar + tabs + cards + table + modal" screen. The admin experience layer defines the administrator job, information hierarchy, entity relationships, action hierarchy, operational states, attention model, and the right workspace/interaction pattern first.

## 2. What you still provide

You still provide the product itself:
- what you want to build;
- target users;
- business rules;
- branding/design preferences;
- required integrations;
- platforms;
- constraints;
- credentials/configuration when appropriate.

The pack is the operating system, not the product specification.

## 3. New project startup

Say:

> Start this project using the Antigravity Project Operating System. Follow AGENTS.md. Do not code yet.

Expected sequence:
1. Ask project name.
2. Save it.
3. Inspect repo/environment.
4. Run discovery.
5. Ask follow-up questions.
6. Draft specifications.
7. Freeze requirements.
8. Build the master plan.
9. Create tasks.
10. Begin the first task only after the above are complete.

## 4. During development

Only one task is active at a time. A feature is not complete until every applicable layer works together.

A task must move through:
PLAN → IMPLEMENT → TEST → VERIFY → AUDIT → RECORD → COMPLETE

## 5. If a session ends

State is written to `docs/memory/`. The next session reads it, checks the actual repository, and resumes from the first unfinished task.

## 6. If something is broken

Do not skip it and move on. Record the failure, identify root cause, fix it, rerun affected tests, and update the state.

If a dependency is genuinely unavailable, mark BLOCKED rather than pretending it is done.

## 7. Code cleanliness

Before adding code:
- search for existing implementations;
- reuse when behavior is genuinely shared;
- avoid duplicate logic;
- remove safe dead code;
- keep the folder structure understandable.

The goal is maintainability, not maximum abstraction.

## 8. API philosophy

APIs are contract-first, typed where the stack supports it, validated, secured, tested, documented, and integrated immediately.

A developer should be able to understand and modify an API without reverse-engineering a maze of abstractions.

## 9. Final release

The final audit checks requirements, features, routes, links, APIs, code health, security, tests, browser behavior, dependencies, documentation, and persistent state.

Only evidence-backed work can be marked COMPLETE. "Evidence" is not a vague
idea here — `docs/EVIDENCE_STANDARDS.md` spells out exactly what proof looks
like for each kind of claim (tests, browser checks, route audits, security
checks, and so on). If that proof can't be produced, the honest status is
BLOCKED, not COMPLETE.

## 10. Reading this pack itself

Every file in this pack is tagged `[RULE]`, `[TEMPLATE]`, `[STATE]`,
`[AGENT]`, or `[SKILL]` (see the File Map section of `AGENTS.md`). `[RULE]`
and `[AGENT]`/`[SKILL]` files are the operating system and shouldn't change
during normal feature work; `[TEMPLATE]` files get filled in during
Discovery/Specification; `[STATE]` files are the ones you and Antigravity
should be updating constantly as the project progresses.
