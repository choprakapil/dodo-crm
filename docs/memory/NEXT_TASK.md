[STATE]

# Next Task

## CURRENT VERSION: Universal CRM V1.1
STATUS: Slices 1–8 LOCKED | Phases 1–7 COMPLETE | Phases B.0–B.7 COMPLETE | Phase B.7.5 COMPLETE | Phase B.7.6 COMPLETE / VERIFIED
CURRENT ACTIVITY: Phase B.7.6 Remediation & Hardening Complete
NEXT TASK: B.8 (Controlled dummy-data cleanup) — NEXT AUTHORIZED PHASE, pending explicit user authorization
PHASE 8: BLOCKED / UNTOUCHED (Requires explicit user authorization)
SOURCE OF TRUTH: docs/CRM_MASTER_SYSTEM_GUIDE.md

---

## 1. Current State
- All foundational and platform capabilities specified across Slices 1 through 8 are fully implemented, verified, security-audited, tested, and locked.
- Customer Identity Schema, Universal Phone Normalization, Customer Resolution Service, and Lead/Enquiry Compatibility (Phases 1–3) are implemented and verified.
- Phase 4A & 4B Historical Customer Backfill were executed with complete conflict safety.
- Phase 5 Customer CRUD, Permissions, Contact Management, Data Scope Enforced Customer Profile, and Soft Deletion are fully implemented and verified.
- Phase 6 Primary Create Enquiry Workflow, Offerings Catalog, Server-Side Price Override Engine, Customer Directory Visibility, and Data-Scope-Filtered Customer History Preview are fully implemented and verified.
- Phase 7 Disposition Management & Follow-Up Lifecycle Engine is fully implemented and verified:
  - Arbitrary-depth disposition tree with materialized paths, generic rules, and contradictory rule prevention.
  - Strict invariant `ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK` enforced via PostgreSQL partial unique index.
  - Rescheduling as an immutable lifecycle event (`TaskRescheduleHistory`), with current task status remaining `PENDING`.
  - Atomic, idempotent overdue synchronization strictly scoped to `TaskType.FOLLOW_UP`.
  - Atomic Call Outcome logging and lead disposition update transaction.
  - Admin Dispositions Workspace (`/app/settings/dispositions`) and Lead Call Outcome Modal.
- All 40 master test suites pass (100% pass across Slices 1–8 and Phases 1–7).
- TypeScript: 0 errors (`npm run type-check`).
- ESLint: 0 errors (`npm run lint`).
- Production build: 74/74 routes compiled successfully (`npm run build`).

---

## 2. Next Phase: Phase 8 — Conversion Engine & Won/Lost Lead Pipeline Architecture (Awaiting Authorization)

Scope for Phase 8 (When Authorized):
- **Lead Lifecycle State Architecture**:
  - Formal conversion workflow from active Enquiry to Won Deal / Converted Customer.
  - Lifecycle state machine: `ENQUIRY → WON / CONVERTED | LOST | REOPENED`.
  - Terminal state validation: prevents modifications to converted enquiries unless formally reopened by authorized managers.
- **Conversion Entity & Audit Trail**:
  - `LeadConversion` model linking Enquiry (`Lead`), `Customer`, deal value, quoted offering, and performing user.
  - Full conversion audit logging in `AuditLog` and Lead activity timeline.
- **Follow-Up Invariant Synchronization**:
  - When an enquiry converts or closes lost: any remaining active follow-up task is automatically cancelled server-side.
- **Task Status Lifecycle Clarification**:
  - `TaskStatus` enum values: `PENDING`, `OVERDUE`, `COMPLETED`, `CANCELLED`.
  - Rescheduling does not change `TaskStatus` to `RESCHEDULED`; it resets the task status to `PENDING` with new `dueAt` and records an immutable `TaskLifecycleEventType.RESCHEDULED` in `task_reschedule_histories`.
  - Reopening a completed or cancelled task transitions status back to `PENDING` and records `TaskLifecycleEventType.REOPENED` (subject to the partial unique index `tasks_single_active_followup_per_lead_idx`).
- **Execution Gate**:
  - Do NOT start Phase 8 or Phase B.8 without explicit user authorization.

---

## 3. Strict Rule Reminder

STOP AFTER B.7.6 HARDENING.
Do NOT automatically start Phase 8, Phase B.8, or any subsequent phase without explicit user instructions.
