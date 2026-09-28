[STATE]

# Next Task

## CURRENT VERSION: Universal CRM V1.1
STATUS: Slices 1–8 LOCKED | Phases 1–7 COMPLETE & VERIFIED
CURRENT ACTIVITY: Phase 7 Disposition Management + Follow-Up Lifecycle Engine Complete | Ready for Phase 8
V1.1 PHASES 1–7: COMPLETE & VERIFIED
NEXT TASK: Phase 8 — Conversion Engine & Won/Lost Lead Pipeline Architecture (Subject to User Authorization)
SOURCE OF TRUTH: docs/LEAD_INTELLIGENCE_AND_CRM_CUSTOMIZATION_ARCHITECTURE.md

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

Scope for Phase 7:
- **Hierarchical Disposition System**:
  - Two-level tree: Disposition Category (e.g. Interested, Follow-up, Not Interested, Lost) → Sub-disposition (e.g. Price Issue, Competitor, Needs Demo).
  - Configurable disposition rules and mandatory remark enforcement.
- **Complete Follow-Up Lifecycle (Reusing Existing Task System)**:
  - Strict reuse of the existing `Task` model (`model Task`) — do NOT create a parallel follow-up architecture.
  - Full state lifecycle: `PENDING → COMPLETED → RESCHEDULED → CANCELLED → OVERDUE`.
  - **Cardinality Invariant**: An active enquiry has at most ONE active follow-up Task for the relevant follow-up workflow.
  - **Reschedule Without Duplication**:
    - When a customer requests another callback ("Call me tomorrow", disposition: `CALL_BACK_REQUESTED`): the existing active follow-up Task is updated with the new date/time and marked `RESCHEDULED` rather than creating redundant tasks.
    - When a customer does not answer (`NO_ANSWER`): the agent schedules/reschedules the next follow-up. `NO_ANSWER` must NOT create unlimited orphan tasks.
  - **Immutable Follow-Up History / Audit Trail**:
    - Every reschedule, completion, or cancellation preserves an immutable log containing:
      - Previous scheduled date/time
      - New scheduled date/time
      - Action/outcome
      - Disposition linked
      - Reason (where provided)
      - User who performed the action
      - Timestamp
    - Historical follow-up events are never overwritten. Current Task represents the active state; history records every past state transition.
  - **Overdue Management**: Follow-ups past `dueAt` become `OVERDUE` and allow authorized users to complete, reschedule, or cancel.
  - **Disposition Coupling Rules**:
    - If disposition means "Do Not Contact" / Closed Lost, any active follow-up associated with that enquiry is automatically cancelled server-side.
    - If a disposition requires a follow-up, the enquiry cannot be completed or saved until the required follow-up is successfully scheduled.
  - **Security & Authorization**: Every follow-up action strictly respects Tenant Isolation, RBAC (`tasks.create`, `tasks.update`), Data Scope (`OWN`, `TEAM`, `COMPANY`), and assignment rules.
- **Conversion Engine**:
  - Enquiry conversion workflow, customer status advancement, revenue logging, and conversion audit trail.
- **Execution Gate**:
  - Do NOT start Phase 7 until Phase 6 is reviewed and authorized by the user.

---

## 3. Strict Rule Reminder

STOP AFTER PHASE 6.
Do NOT automatically start Phase 7 or any subsequent phase without explicit user instructions.
