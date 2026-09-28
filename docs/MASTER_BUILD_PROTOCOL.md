[RULE]

# Master Build Protocol — Plan First, Build Complete, Then Continue

## Core Rule

The project must NEVER be developed as a sequence of disconnected UI fragments.

The AI must first understand and document the complete product:
- users;
- platforms;
- routes;
- features;
- permissions;
- data;
- APIs;
- integrations;
- design system;
- states;
- dependencies;
- infrastructure;
- testing;
- release;
- operations.

Only after the plan is approved/frozen may implementation begin.

## Required Lifecycle

`DISCOVER → PLAN → ARCHITECT → DESIGN → SLICE → BUILD → TEST → INTEGRATE → VERIFY → DOCUMENT → CLOSE → RECOMMEND NEXT`

### Phase 0 — Discovery
Inspect:
- repository;
- existing code;
- package versions;
- environment;
- database;
- deployment;
- existing UI;
- routes;
- API contracts;
- mobile/admin code;
- current TODOs;
- known failures.

Do not overwrite or redesign existing working behavior blindly.

### Phase 1 — Complete Project Plan

Create/maintain:
- `docs/MASTER_PLAN.md`
- `docs/PROJECT_MAP.md`
- `docs/FEATURE_COMPLETION_MATRIX.md`
- `docs/MOBILE_FEATURE_MATRIX.md`
- `docs/REQUIREMENTS_TRACEABILITY.md`
- `docs/ROUTE_LINK_REGISTRY.md`
- `docs/TASK_REGISTRY.md`
- architecture documents;
- design system;
- API/database contracts;
- release strategy.

Every feature receives:
- unique ID;
- owner/agent;
- platforms;
- dependencies;
- acceptance criteria;
- failure states;
- security considerations;
- analytics needs;
- accessibility requirements;
- performance requirements;
- test plan;
- completion evidence.

### Phase 2 — Architecture Freeze

Decide before coding:
- Next.js architecture;
- rendering strategy;
- server/client boundaries;
- data-fetching strategy;
- cache/revalidation strategy;
- API/BFF boundaries;
- authentication/session strategy;
- database schema;
- storage/media strategy;
- queues/background work;
- observability;
- deployment;
- environment configuration;
- platform strategy;
- dependency strategy.

If a later discovery invalidates architecture, record a decision change before implementing around it.

### Phase 3 — Design Freeze

Define:
- brand direction;
- typography;
- spacing;
- grid;
- components;
- motion;
- responsive behavior;
- accessibility;
- loading/error/empty states;
- admin design;
- mobile design;
- system messages.

Public web design must remain bespoke and premium.

### Phase 4 — Break Plan Into Vertical Slices

Break the master plan into **complete vertical slices**, not isolated components.

Bad slice:
> "Build homepage hero."

Good slice:
> "Complete public homepage: route + content + responsive design + SEO + images + loading + error + analytics + accessibility + tests + production verification."

Each slice must have:
- prerequisites;
- exact scope;
- files/modules affected;
- acceptance criteria;
- tests;
- definition of done;
- rollback/recovery strategy.

### Phase 5 — Build One Slice Completely

The AI must:
1. select the highest-priority unfinished slice;
2. announce the slice and acceptance criteria;
3. implement all layers required by that slice;
4. test it;
5. fix discovered defects;
6. integrate it with existing features;
7. run regression checks;
8. update project documentation;
9. mark it complete only when evidence satisfies the definition of done.

**Do not move to the next feature while the current slice is half-built.**

### Phase 6 — Completion Gate

A slice is complete only when:
- frontend works;
- backend/API works if applicable;
- database works if applicable;
- admin works if applicable;
- mobile works if applicable;
- authentication/permissions work if applicable;
- loading states work;
- empty states work;
- errors work;
- network failure behavior works;
- accessibility works;
- SEO works where applicable;
- analytics works where applicable;
- tests pass;
- production build passes;
- no unexplained console/runtime errors;
- documentation is updated;
- no known TODO remains inside the slice.

### Phase 7 — Close the Slice

Update:
- completion matrix;
- task registry;
- route registry;
- API contracts;
- architecture state;
- design state;
- changelog;
- known issues.

Do not hide unfinished work under "done".

Use explicit statuses:
`planned / ready / in-progress / blocked / needs-review / complete / deferred`.

### Phase 8 — Recommend Next

Only after the current slice is genuinely complete:
- recalculate dependencies;
- inspect remaining priority;
- identify blockers;
- choose the next logical slice;
- explain why it is next;
- show scope and acceptance criteria.

Then STOP and wait for the user/agent orchestration rule to authorize the next slice if the workflow requires human approval.

## No Half-Baked Feature Rule

If a feature cannot be completed end-to-end because a dependency is missing:
1. mark it `blocked`;
2. explain the exact blocker;
3. do not fake the UI;
4. do not silently substitute fake APIs/data;
5. identify the smallest dependency slice that unblocks it;
6. recommend that dependency as the next task.

## No "Looks Finished" Rule

A screenshot is not proof of completion.

Completion requires behavior + integration + failure paths + test evidence.

## Resume Rule

When work resumes:
1. read the master plan;
2. read project map;
3. inspect current git/code state;
4. inspect completion matrix;
5. inspect task registry;
6. identify last incomplete slice;
7. verify whether it is actually complete;
8. continue from the smallest safe point.

Never assume the previous session completed something merely because a file exists.
