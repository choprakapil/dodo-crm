# B.7.6 Agent Governance Audit

**Date:** 2026-09-29
**Auditor:** Antigravity Forensic Governance Subsystem
**Scope:** Repository-wide inspection of instructions, personas, skills, hooks, loading mechanics, state synchronization, and execution guardrails.

---

## 1. Executive Result

### **AGENT GOVERNANCE STATUS: NOT ENFORCED (TECHNICAL) / PARTIALLY ENFORCED (PROMPT-LEVEL ONLY) — HARDENING REQUIRED**

- **Prompt-Level Enforcement**: `AGENTS.md` and `GEMINI.md` are automatically read by the Antigravity IDE and injected into the LLM system prompt under `<user_rules>`. The primary agent is aware of the rules.
- **Technical Enforcement**: **0%**. There are **no git hooks**, **no CI/CD pipelines**, **no AST linter barriers**, **no file-write permission locks**, and **no pre-command execution gates**.
- **Skill Discovery Failure**: The 58 project skills located in `<workspaceRoot>/skills/` are **not loaded into the Antigravity IDE skill catalog** because the IDE only auto-discovers workspace skills inside `<workspaceRoot>/.agents/skills/`.
- **Agent Roles**: The 50 agent files in `agents/` are passive markdown role descriptions. There is no orchestrator process or IDE daemon that dispatches or enforces multi-agent handoffs.
- **Bypass Vulnerability**: Any agent can edit `schema.prisma`, run destructive SQL, skip tests, or start Phase 8 without any automated system blocking the operation.

---

## 2. Complete Instruction Inventory

| File Path | Nature / Tag | Size | Auto-Loaded by IDE? | Enforcement Mechanism | Bypassable? |
|---|---|---|---|---|---|
| `AGENTS.md` (Root) | `[RULE]` | 21,391 B | **YES** (Injected as `<RULE>` in system prompt) | System prompt text instruction | **YES** (Agent can choose to ignore prompt) |
| `GEMINI.md` (Root) | `[RULE]` | 574 B | **YES** (Injected as `<RULE>` in system prompt) | System prompt text instruction | **YES** |
| `universal-crm/AGENTS.md` | Dev banner | 678 B | **NO** (Ignored by IDE workspace root) | Next.js dev banner | **YES** |
| `universal-crm/CLAUDE.md` | Redirect | 11 B | **NO** | Text pointer (`@AGENTS.md`) | **YES** |
| `PACK_MANIFEST.md` | `[RULE]` | 3,127 B | **NO** (Must be opened manually) | Passive documentation | **YES** |
| `ADMIN_EXPERIENCE_V7_ENHANCEMENT.md` | `[RULE]` | 556 B | **NO** | Passive documentation | **YES** |
| `V12_README.md` | `[RULE]` | 879 B | **NO** | Passive documentation | **YES** |
| `README.md` (Root) | Informational | 7,738 B | **NO** | Passive documentation | **YES** |
| `docs/MASTER_BUILD_PROTOCOL.md` | `[RULE]` | 5,560 B | **NO** (Referenced in `AGENTS.md`) | Voluntary read via `view_file` | **YES** |
| `docs/EVIDENCE_STANDARDS.md` | `[RULE]` | 6,068 B | **NO** (Referenced in `AGENTS.md`) | Voluntary read via `view_file` | **YES** |
| `docs/CRM_MASTER_SYSTEM_GUIDE.md` | `[STATE]` | 104,266 B | **NO** (Referenced in `PROJECT_STATE.md`) | Voluntary read via `view_file` | **YES** |
| `scripts/*.md` (Root, 6 files) | `[SCRIPT]` | ~200 B each | **NO** | Passive markdown checklists | **YES** |

---

## 3. Agent Inventory (50 Files in `agents/`)

All 50 files in `agents/` are markdown persona prompts. They are not executable software agents, background daemons, or separate processes.

| Category | Agent Count | Agent Names | Enforcement Type | Can Primary Agent Bypass? |
|---|---|---|---|---|
| **Architecture & Product** | 10 | `product-intelligence-architect`, `product-manager`, `technical-architect`, `entity-relationship-architect`, `workflow-state-architect`, `admin-workspace-architect`, `admin-action-architect`, `admin-experience-architect`, `nextjs-architecture-engineer`, `ux-architect` | Advisory markdown | **YES** (Zero programmatic invocation) |
| **Engineering & Implementation** | 8 | `backend-engineer`, `frontend-engineer`, `admin-engineer`, `database-engineer`, `database-guardian`, `integration-engineer`, `resilience-engineer`, `cross-platform-integration-engineer` | Advisory markdown | **YES** |
| **Quality, QA & Verification** | 12 | `completion-auditor`, `feature-completion-auditor`, `spectator-verification-agent`, `test-orchestrator`, `qa-release-engineer`, `runtime-observer`, `admin-ux-regression-engineer`, `screenshot-design-verification`, `design-qa-engineer`, `route-integrity-auditor`, `code-quality-engineer`, `dependency-auditor` | Advisory markdown | **YES** (Primary builder can mark task complete without spectator check) |
| **Security & Privacy** | 4 | `security-engineer`, `security-red-team`, `security-ux-architect`, `failure-path-engineer` | Advisory markdown | **YES** |
| **Web & Design Aesthetics** | 6 | `premium-web-art-director`, `web-performance-engineer`, `seo-engineer`, `accessibility-engineer`, `design-system-extractor`, `mobile-app-orchestrator` | Advisory markdown | **YES** |
| **Governance & Coordination** | 10 | `orchestrator`, `project-orchestrator`, `admin-ui-orchestrator`, `plan-integrity-guardian`, `change-impact-analyst`, `context-curator`, `repository-cartographer`, `contract-sentinel`, `admin-audit-architect`, `admin-notification-architect` | Advisory markdown | **YES** |

---

## 4. Skill Inventory (58 Directories in `skills/`)

The repository contains 58 skill definitions in `<workspaceRoot>/skills/`. Each directory contains a `SKILL.md` file.

### Critical Discovery: Skills Are Not Registered in Antigravity Tooling
- Antigravity IDE custom skill discovery specifically requires workspace skills to reside in `.agents/skills/<skill_name>/SKILL.md` (or the global root `~/.gemini/config/`).
- Because all 58 skills are placed in `skills/` at the repository root, **none of them appear in the agent's active `<skills>` prompt**.
- The only skills visible in the agent's IDE catalog are global plugins (e.g. `chrome-devtools`, `firebase`, `modern-web-guidance`).
- **Conclusion**: All 58 project skills are **UNLOADED / INVISIBLE** to the IDE's automated skill matcher and can only be accessed if the agent explicitly opens them with `view_file`.

| Key Skill Domain | Count | Skill Names | IDE Catalog Status | Can Agent Bypass? |
|---|---|---|---|---|
| **Architecture & Database** | 6 | `database-integrity`, `entity-relationship-intelligence`, `workspace-architecture`, `workflow-state-design`, `api-readiness`, `api-contracts` | **NOT LOADED** | **YES** |
| **Security & Operations** | 5 | `security-gate`, `security-ux`, `audit-trail-activity`, `failure-path`, `error-state-system` | **NOT LOADED** | **YES** |
| **Verification & Quality** | 10 | `final-audit`, `regression-check`, `spectator-verification`, `definition-of-done`, `end-to-end-feature`, `route-link-audit`, `screenshot-qa-loop`, `admin-ux-regression`, `code-reuse`, `dead-code-cleanup` | **NOT LOADED** | **YES** |
| **Governance & Planning** | 8 | `discovery-first`, `specification-freeze`, `task-decomposition`, `plan-integrity`, `change-management`, `change-impact-analysis`, `requirements-question-loop`, `session-continuity` | **NOT LOADED** | **YES** |
| **UX & Admin Productivity** | 15 | `admin-experience-first`, `anti-generic-admin-ui`, `admin-composition-patterns`, `attention-exception-design`, `saved-views-filters`, `search-command-architecture`, `keyboard-productivity`, `admin-action-hierarchy`, `data-visualization-intelligence`, etc. | **NOT LOADED** | **YES** |
| **Web & Performance** | 14 | `design-system-first`, `spacing-layout-check`, `typography-check`, `icon-usage-check`, `premium-scroll-design`, `performance-budget`, `network-resilience`, `media-accessibility`, `seo-hierarchy`, etc. | **NOT LOADED** | **YES** |

---

## 5. Workflow / Hook Inventory

| Tool / Hook Type | Location Inspected | Present? | Active Configuration |
|---|---|---|---|
| **Git Pre-commit Hook** | `.git/hooks/pre-commit` | **NO** | Only `pre-commit.sample` exists |
| **Git Pre-push Hook** | `.git/hooks/pre-push` | **NO** | Only `pre-push.sample` exists |
| **CI / CD Workflows** | `.github/workflows/` | **NO** | Directory does not exist |
| **Antigravity Hooks** | `hooks.json` / `.antigravity/` | **NO** | Neither file nor directory exists |
| **Antigravity MCP Config**| `mcp_config.json` | **NO** | MCP servers configured globally only |
| **Husky / Lint-Staged** | `package.json` | **NO** | Not installed in dependencies |
| **Automated Phase Locks**| `.harness/context/` | **NO** | Contains only unpopulated placeholder markdown |

---

## 6. Actual Loading Mechanisms

```
+-------------------------------------------------------------+
|                 Antigravity IDE Session Startup             |
+-------------------------------------------------------------+
                              |
     [Auto-Loaded]            |            [NOT Auto-Loaded]
     - AGENTS.md              |            - 50 agents/*.md
     - GEMINI.md              |            - 58 skills/*/SKILL.md
     - Global ~/.gemini/*     |            - docs/MASTER_BUILD_PROTOCOL.md
                              |            - docs/memory/* (Advisory read only)
                              v
+-------------------------------------------------------------+
|              LLM Agent Context Window (Prompt)              |
+-------------------------------------------------------------+
                              |
                Relies on Agent Volition
                (Zero Programmatic Interception)
                              |
                              v
+-------------------------------------------------------------+
|         Tool Calls (run_command, write_to_file, etc.)       |
|      Can directly modify DB, schema, and bypass all tests   |
+-------------------------------------------------------------+
```

1. **How is it loaded?**
   Only `AGENTS.md` and `GEMINI.md` are loaded automatically by the IDE at session initialization.
2. **Who loads it?**
   The Antigravity host application injects them as prompt text strings.
3. **Is there a hook or wrapper enforcing it?**
   **No.** There is no runtime process intercepting tool calls.
4. **Can an agent ignore it?**
   **Yes.** If an LLM hallucinates, forgets context, or receives a user prompt that contradicts `AGENTS.md`, nothing in the execution environment prevents the agent from executing prohibited file edits or commands.

---

## 7. Bypass Analysis

| Action | Stated Rule in `AGENTS.md` | Can Agent Bypass Today? | How Bypass Occurs |
|---|---|---|---|
| **Start Phase 8 Without Authorization** | Hard Rule: "Do NOT start Phase 8 without authorization" | **YES** | Agent can call `write_to_file` to create `LeadConversion` model and endpoints; no gate stops it. |
| **Modify Locked Prisma Schema** | Architecture Rule: Slices 1–8 & Phases 1–7 locked | **YES** | Agent can edit `schema.prisma` directly via `replace_file_content`. |
| **Execute Destructive DB Reset** | "accidental-data-loss-prevention" skill | **YES** | Agent can run `npm run db:reset` or `prisma db push --force-reset` via `run_command`. |
| **Skip Tests Before Declaring Done** | Delivery Rule: Must run `npm test`, `type-check`, `build` | **YES** | Agent can claim "Everything passed" in text without issuing a single tool call. |
| **Overwrite State Documents** | Rule: State files must reflect verified facts | **YES** | Agent can write fabricated data into `PROJECT_STATE.md`. |
| **Bypass Spectator Verification** | V11 OS: "Builder must not be the sole judge of completion" | **YES** | Builder agent simply writes the final response without invoking the spectator agent. |

---

## 8. Source-of-Truth Conflicts

An audit across all documentation files revealed 8 concrete contradictions:

| # | Topic | File A & Claim | File B & Claim | Actual Code/Repo Reality | Required Correction |
|---|---|---|---|---|---|
| 1 | **Current Milestone & Version** | `docs/memory/AGENT_HANDOFF.md:6-9`<br>"Date: 2026-09-17, Version: V1.0, V1.1 Status: PLANNED - NOT STARTED" | `docs/memory/PROJECT_STATE.md:5`<br>"Date: 2026-09-28, Version: V1.1, Phases 1-7 COMPLETE, B.0-B.7 COMPLETE" | Phases 1–7 and B.0–B.7 are fully implemented in `universal-crm/` with 40 passing test suites | Update `AGENT_HANDOFF.md` to reflect V1.1 complete state |
| 2 | **Next Task Scope** | `docs/memory/NEXT_TASK.md:35-65`<br>Section 2 header says "Next Phase: Phase 8", but text body details Phase 7 tasks and says "Do NOT start Phase 7" | `docs/memory/PROJECT_STATE.md:9`<br>"V1.1 Phases 1-7: COMPLETE & VERIFIED" | Phase 7 is finished and verified in code | Replace Phase 7 copy in `NEXT_TASK.md` with authorized next steps |
| 3 | **Task Status Enum** | `docs/memory/NEXT_TASK.md:41`<br>"Full state lifecycle: PENDING -> COMPLETED -> RESCHEDULED -> CANCELLED -> OVERDUE" | `universal-crm/prisma/schema.prisma:57-71`<br>`enum TaskStatus { PENDING, OVERDUE, COMPLETED, CANCELLED }` | `RESCHEDULED` is an event in `TaskLifecycleEventType`, NOT a `TaskStatus` | Update `NEXT_TASK.md` to state that rescheduled tasks return to `PENDING` |
| 4 | **Lifecycle Event: REOPENED** | `docs/CRM_MASTER_SYSTEM_GUIDE.md:528`<br>"REOPENED: Task reopened (if supported)" | `universal-crm/lib/services/follow-up.service.ts:867`<br>Explicitly sets `eventType = TaskLifecycleEventType.REOPENED` when status changed to `PENDING` | Supported in backend service, but omitted in UI and has 0 tests | Document that `REOPENED` is a backend service transition only |
| 5 | **Template Count** | Prior reports/prompts: "7 pre-built industries" (e.g. saas, etc.) | `docs/CRM_MASTER_SYSTEM_GUIDE.md:606-612` & `universal-crm/lib/templates/definitions/` | Exactly 4 templates exist: `general-sales`, `real-estate`, `healthcare`, `education` | Remove all references to 7 templates from future reports |
| 6 | **Onboarding State Machine** | `docs/CRM_MASTER_SYSTEM_GUIDE.md:550-560`<br>Calls onboarding a "4-step wizard" (PROFILE, TEAM, OFFERINGS, PIPELINE) | `universal-crm/lib/validations/onboarding.ts:22` & `components/onboarding/onboarding-wizard.tsx:108-115` | 6 discrete states: `PROFILE`, `TEMPLATES`, `TEAM`, `OFFERINGS`, `PIPELINE`, `COMPLETED` | Update Master Guide to document all 6 states |
| 7 | **Customer Merge** | Historical expectations / summaries | `universal-crm/lib/services/customer.service.ts` | Customer Merge does not exist in any file. Only Customer Link and Unlink exist | Explicitly label Customer Merge as `NOT IMPLEMENTED / PLANNED` |
| 8 | **Currency Defaults** | `docs/INDUSTRY_TEMPLATES.md:96`<br>"Zero Implicit USD Fallback... fails closed" | `universal-crm/prisma/schema.prisma:144, 492` & `validations/platform.ts:29` | Database and Zod schemas contain `DEFAULT 'USD'` | Flag as an architectural inconsistency requiring schema migration |

---

## 9. Phase-Gate Analysis

- **Current Mechanism**: Text-only statement in `AGENTS.md` ("STOP AFTER PHASE 7", "Do NOT start Phase 8").
- **Effectiveness**: **Low**. If an agent is prompted with "Implement deal conversion", it will proceed unless it actively remembers the negative constraint.
- **Missing Protection**: There is no programmatic phase lock (e.g. a check script in `npm test` or `package.json` that asserts `lead_conversions` does not exist and aborts if unauthorized files are touched).

---

## 10. Architecture Protection Analysis

- **Current Mechanism**: Text warning in `AGENTS.md` ("Do not edit this file, or any file under docs/, agents/, or skills/ during normal feature work").
- **Effectiveness**: **Low**. Antigravity IDE grants full workspace write access.
- **Missing Protection**: There are no git pre-commit hooks preventing modifications to `prisma/schema.prisma` without an associated architectural decision record in `docs/DECISION_LOG.md`.

---

## 11. Destructive Operation Protection

- **Current Mechanism**: Global skill `accidental-data-loss-prevention` warns the agent to ask before running `DROP TABLE` or `DELETE`.
- **Effectiveness**: **Medium**. The prompt rule provides cognitive pause, but if the agent hallucinates or runs `npm run db:reset`, the database is wiped immediately with zero terminal confirmation prompts.
- **Missing Protection**: `universal-crm/package.json` contains:
  ```json
  "db:reset": "prisma migrate reset --force && npm run seed"
  ```
  The `--force` flag explicitly bypasses interactive confirmation! Anyone running `npm run db:reset` wipes all tenant data instantly.

---

## 12. Verification Enforcement

- **Current Mechanism**: Process guidelines in `docs/EVIDENCE_STANDARDS.md`.
- **Effectiveness**: **Low**. The system relies on the agent honestly running commands and pasting terminal output.
- **Missing Protection**: No automated build or test pipeline is triggered upon file modification.

---

## 13. Current Risks

1. **Unregistered Skills**: 58 custom CRM skills provide zero automated assistance to the agent because they are outside `.agents/skills/`.
2. **Phase Boundary Breaches**: Phase 8 can be accidentally implemented if an agent misinterprets user requests.
3. **Database Reset Hazard**: `npm run db:reset` uses `--force` and can destroy test or development databases instantly.
4. **State Document Drift**: `AGENT_HANDOFF.md` and `NEXT_TASK.md` have already drifted from active code.
5. **Currency Schema Leak**: Prisma column defaults silently insert `'USD'` on raw database writes.

---

## 14. Recommended Technical Enforcement Architecture

To transition from "Prompt-Only Trust" to "Hardened Programmatic Enforcement", implement the following layered architecture:

```
+---------------------------------------------------------------------------------+
|                                 LAYER 1: IDE INTEGRATION                        |
| - Symlink or move `skills/*` into `.agents/skills/*` to enable IDE auto-match   |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                                 LAYER 2: PHASE LOCK SCRIPT                      |
| - Add `scripts/governance/check-phase-lock.ts` executed before build/test       |
| - Hard-fails if files matching `conversion`, `LeadConversion` are introduced   |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                                 LAYER 3: GIT PRE-COMMIT HOOKS                   |
| - Husky / Git hook running `npm run type-check` and `check-phase-lock`          |
| - Blocks commits modifying `prisma/schema.prisma` without DECISION_LOG entry    |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
|                                 LAYER 4: SAFE COMMAND WRAPPERS                  |
| - Remove `--force` from `db:reset` script in `package.json`                     |
| - Require environment variable `ALLOW_DESTRUCTIVE_RESET=true`                   |
+---------------------------------------------------------------------------------+
```

---

## 15. Required Changes

### Category 1: Technical Governance (Hard Gates)
1. **Enable Native Skill Discovery**: Symlink `<workspaceRoot>/skills/` to `<workspaceRoot>/.agents/skills/` so Antigravity IDE natively exposes all 58 skills.
2. **Destructive Command Hardening**: Edit `universal-crm/package.json` to remove `--force` from `db:reset` and add a safety confirmation guard.
3. **Phase 8 Lock Script**: Create an executable pre-flight verification script (`scripts/governance/verify-phase-locks.ts`) that asserts Phase 8 models remain absent.

### Category 2: Schema Hardening
1. **Prisma Currency Migration**: Remove `@default("USD")` from `Company.currency` and `Offering.currency`, ensuring strict fail-closed currency behavior.
2. **API Schema Cleanup**: Remove `.default("USD")` from `validations/platform.ts:29`.

### Category 3: Documentation State Reconciliation
1. Update `docs/memory/NEXT_TASK.md` (remove stale Phase 7 text, clarify `TaskStatus` vs `TaskLifecycleEventType`).
2. Update `docs/memory/AGENT_HANDOFF.md` (reconcile date and V1.1 status).
3. Update `docs/CRM_MASTER_SYSTEM_GUIDE.md` (6-step onboarding, dual DB/service partial unique index enforcement, clarify customer merge).

---

## 16. Evidence Table

| File | Line/Range | Concrete Evidence | Conclusion |
|---|---|---|---|
| `AGENTS.md` | Lines 1–45 | Master build rules written in markdown | Text rules exist, but no runtime daemon enforces them |
| `.agents/skills/` | Dir listing | Contains only 2 Prisma skills; 0 of the 58 CRM skills exist here | The 58 project skills are completely invisible to IDE skill discovery |
| `skills/` | 58 subdirs | 58 skill directories exist in root | Misplaced relative to Antigravity's `.agents/skills/` root |
| `agents/` | 50 `.md` files | 50 persona markdown files | Passive prompts; not executable agent processes |
| `.git/hooks/` | Dir listing | All files have `.sample` extension | Zero active git hooks |
| `.github/` | Path check | Directory does not exist | Zero CI/CD automation |
| `package.json` | Line 21 | `"db:reset": "prisma migrate reset --force && npm run seed"` | Destructive wipe command can be executed without confirmation |
| `data-integrity.service.ts` | Lines 257–270 | Checks `information_schema.tables` for `lead_conversions` and confirms absent | Runtime proof that Phase 8 is blocked and unbuilt |
| `schema.prisma` | Line 70 | `enum TaskLifecycleEventType { ... REOPENED }` | `REOPENED` exists in database enum |
| `follow-up.service.ts` | Line 867 | `eventType = TaskLifecycleEventType.REOPENED` | Reopen logic implemented in service layer |
| `schema.prisma` | Lines 144, 492 | `currency String @default("USD")` | Latent USD fallback exists in database schema |
| `validations/platform.ts` | Line 29 | `currency: ...default("USD")` | Company creation API silently injects USD if omitted |
| `docs/memory/AGENT_HANDOFF.md` | Lines 5–9 | "Date: 2026-09-17, Version: V1.0, V1.1 Status: PLANNED" | State document is 11 days stale |
| `docs/memory/NEXT_TASK.md` | Lines 35–65 | Future-tense planning text for completed Phase 7 | State document copy-paste error |

---

## 17. Final Gate

### **AGENT GOVERNANCE STATUS: NOT ENFORCED — HARDENING REQUIRED**

- **CURRENT SAFE PHASE**: Universal CRM V1.1 (Slices 1–8 Locked | Phases 1–7 Complete | Phases B.0–B.7.5 Complete)
- **AUTHORIZED NEXT PHASE**: None (Awaiting user instructions)
- **BLOCKED PHASES**: Phase 8 (Conversion Engine), Phase B.8, and all subsequent feature additions
- **CODE CHANGES REQUIRED**:
  1. Remove `--force` from `package.json` `db:reset`.
  2. Drop `@default("USD")` from `schema.prisma` (`Company` and `Offering`) via clean migration.
  3. Remove `.default("USD")` from `lib/validations/platform.ts`.
- **DOCUMENT CHANGES REQUIRED**:
  1. Reconcile `docs/memory/NEXT_TASK.md`.
  2. Reconcile `docs/memory/AGENT_HANDOFF.md`.
  3. Update `docs/CRM_MASTER_SYSTEM_GUIDE.md` (6-step onboarding, dual DB/service index enforcement, customer merge status).
- **ENFORCEMENT CHANGES REQUIRED**:
  1. Link `<workspaceRoot>/skills/` to `<workspaceRoot>/.agents/skills/` to enable native IDE skill invocation.
  2. Implement programmatic Phase Lock check script in test pipeline.
  3. Install Git pre-commit hook to block unverified schema/model mutations.
