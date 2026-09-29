[STATE]

# Session State

Date: 2026-09-29
Current Version: Universal CRM V1.1
Status: Slices 1–8 LOCKED | Phases 1–7 COMPLETE | Phases B.0–B.7 COMPLETE | Phase B.7.5 COMPLETE | Phase B.7.6 COMPLETE / VERIFIED
Current Activity: Phase B.7.6 Remediation & Hardening Complete
V1.1 Phases 1–7: COMPLETE & VERIFIED
Phases B.0–B.7: COMPLETE, HARDENED & VERIFIED
Phase B.7.5: COMPLETE & VERIFIED (docs/CRM_MASTER_SYSTEM_GUIDE.md)
Phase B.7.6: COMPLETE / VERIFIED (Company.currency & Offering.currency @default("USD") dropped via migrations, package.json db:reset hardened, phase-lock wired into npm test/build/deploy:prepare, REOPENED lifecycle documented & tested, exactly 4 system templates verified)
B.8: NEXT AUTHORIZED PHASE, pending explicit user authorization
Phase 8: BLOCKED / UNTOUCHED (Requires explicit user authorization)
Source of Truth: docs/CRM_MASTER_SYSTEM_GUIDE.md

---

## What Happened This Session

1. **Prisma Migrations Applied (Strict Migration Protocol, 0 db push)**:
   - `prisma/migrations/20260918170000_phase7_enums`:
     - Added `TaskType` enum (`FOLLOW_UP`, `GENERAL`)
     - Added `TaskLifecycleEventType` enum (`CREATED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`, `MARKED_OVERDUE`)
     - Added `OVERDUE` to `TaskStatus` enum
     - Added `DISPOSITION_CHANGED` and `TASK_RESCHEDULED` to `ActivityType` enum
   - `prisma/migrations/20260918170001_phase7_disposition_and_followup_lifecycle`:
     - Added `dispositions` table with arbitrary-depth hierarchy (`parentId`, `depth`, `path`) and generic rules
     - Added `lead_disposition_histories` table for immutable lead disposition tracking
     - Added `task_reschedule_histories` table for immutable follow-up lifecycle event tracking
     - Added `dispositionId`, `dispositionUpdatedAt`, `dispositionUpdatedById` to `leads` table
     - Added `type` with default `FOLLOW_UP` to `tasks` table
     - Added PostgreSQL partial unique index `tasks_single_active_followup_per_lead_idx` on `("companyId", "leadId") WHERE "leadId" IS NOT NULL AND "type" = 'FOLLOW_UP' AND "status" IN ('PENDING', 'OVERDUE')`
     - Backfilled existing 70 tasks to `type = FOLLOW_UP`

2. **Disposition Management Engine (`lib/services/disposition.service.ts`)**:
   - Arbitrary-depth tree with materialized path maintenance (`/rootId/childId/subChildId`)
   - Cycle detection and self-parenting prevention
   - Server-side rejection of contradictory rules (`cancelActiveFollowUp = true` AND `followUpMandatory = true`) with `ValidationError`
   - Complete tenant isolation and RBAC (`dispositions.view`, `dispositions.create`, `dispositions.update`, `dispositions.delete`, `dispositions.manage`)
   - REST endpoints: `GET /api/v1/dispositions` (flat/tree), `POST /api/v1/dispositions`, `GET/PATCH/DELETE /api/v1/dispositions/[id]`
   - UI: Dispositions Workspace (`/app/settings/dispositions`) and `DispositionDialog`

3. **Follow-Up Lifecycle Service (`lib/services/follow-up.service.ts`)**:
   - Reuses existing `model Task` strictly scoped to `TaskType.FOLLOW_UP`
   - Invariant enforced: `ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK`
   - Rescheduling updates `dueAt`, resets status to `TaskStatus.PENDING`, and appends immutable `TaskRescheduleHistory` (`TaskLifecycleEventType.RESCHEDULED`). Task status never becomes `RESCHEDULED`
   - Independent `GENERAL` tasks untouched
   - Atomic overdue synchronization via PostgreSQL `UPDATE tasks SET status = 'OVERDUE'::"TaskStatus" WHERE "type" = 'FOLLOW_UP'::"TaskType" AND "status" = 'PENDING'::"TaskStatus" AND "dueAt" < NOW() RETURNING id, "companyId", "leadId", "dueAt"`
   - Creates `MARKED_OVERDUE` history only for returned rows; zero duplicate transitions on concurrent executions
   - REST endpoints: `POST /api/v1/follow-ups/[id]/reschedule`, `POST /api/v1/follow-ups/[id]/complete`, `GET /api/v1/follow-ups/[id]/history`, `POST /api/v1/follow-ups/sync-overdue`
   - UI: Reschedule modal, Overdue badge, History dialog, and Overdue Sync trigger in `/app/follow-ups`

4. **Atomic Call Outcome Workflow & Lead Gates (`lib/services/lead.service.ts`)**:
   - Atomic `recordCallOutcome` in a single `prisma.$transaction`:
     - Validates disposition rules (`followUpMandatory` requires `dueAt`)
     - Cancels active follow-up if `cancelActiveFollowUp: true`
     - Reschedules existing active follow-up if present, or creates new follow-up if none exists (upholding invariant)
     - Logs `CALL` activity and `DISPOSITION_CHANGED` activity on lead timeline
     - Updates Lead disposition fields and appends `LeadDispositionHistory`
     - Entire transaction rolls back on any failure
   - Lead close gate: validates that lead cannot transition to closed status if current disposition has `allowsClose: false`
   - REST endpoints: `POST /api/v1/leads/[id]/call-outcome`, `GET /api/v1/leads/[id]/disposition-history`
   - UI: `CallOutcomeDialog` on `/app/leads/[id]`

6. **Phase B.7.6 Hardening**:
   - **Governance Hardening**: Established `.agents/skills` root directory symlinking all 58 repository skills to guarantee agent discovery.
   - **Currency Hardening**: Removed `@default("USD")` from `Offering.currency` in Prisma schema; deployed migration `20260929080000_drop_offering_currency_default` with 0 `db push`; removed `.default("USD")` from platform provisioning validation schema.
   - **Destructive Command Guard**: Hardened `npm run db:reset` in `package.json` to require explicit `ALLOW_DESTRUCTIVE_RESET=true` environment variable.
   - **State-Document Reconciliation**: Reconciled `CRM_MASTER_SYSTEM_GUIDE.md` (Offering currency migration, task index dual enforcement, REOPENED event status, 6 onboarding states, customer merge status), `AGENT_HANDOFF.md`, and `NEXT_TASK.md`.
   - **Phase-Lock Enforcement**: Programmatic phase-lock checker verifying Phase 8 models and features remain absent.

---

## Next Action

Awaiting user approval of Phase B.7.6 before proceeding to B.8 Controlled dummy-data cleanup.
Do NOT start Phase 8 or mutate production data without explicit authorization.
