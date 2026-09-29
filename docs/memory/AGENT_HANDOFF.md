[STATE]

# Agent Handoff

Date: 2026-09-29
Current Version: Universal CRM V1.1
Status: Slices 1–8 LOCKED | Phases 1–7 COMPLETE | Phases B.0–B.7 COMPLETE | Phase B.7.5 COMPLETE | Phase B.7.6 COMPLETE / VERIFIED
Current Activity: B.7.6 Remediation & Hardening Complete
V1.1 Status: Phases 1–7 COMPLETE & VERIFIED
Next Milestone: B.8 (Controlled dummy-data cleanup) — NEXT AUTHORIZED PHASE, pending explicit user authorization
Phase 8: BLOCKED / UNTOUCHED (Requires explicit user authorization)
Source of Truth: docs/CRM_MASTER_SYSTEM_GUIDE.md

---

## 1. Critical Rules for Any Subsequent Agent

1. **DO NOT MODIFY LOCKED SLICES**: Slices 1–8 and Phases 1–7 are complete and locked. Do not start Phase 8 without explicit user authorization.
2. **SOURCE OF TRUTH**: `docs/CRM_MASTER_SYSTEM_GUIDE.md` is the authoritative guide for CRM platform architecture.
3. **DO NOT REBUILD**: Do not rewrite existing working slices, auth architecture, or tenant isolation models.
4. **CURRENCY INVARIANT**: Zero implicit USD fallback. Both `Company.currency` and `Offering.currency` have no database default (`DEFAULT 'USD'` dropped via migrations). Company provisioning and Offering creation reject missing currencies.
5. **RESPECT BOUNDARIES**: Super Admin manages Platform → Companies → Users → Plans → Security → Audit. Super Admin is NOT a tenant CRM.
6. **ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP**: Enforced via PostgreSQL partial unique index `tasks_single_active_followup_per_lead_idx`.
7. **RESCHEDULED IS NOT A STATUS**: Rescheduling creates an immutable event in `task_reschedule_histories`; task status resets to `PENDING`.
8. **DESTRUCTIVE COMMAND SAFETY**: `npm run db:reset` fails closed in production and against remote databases; requires `ALLOW_DESTRUCTIVE_RESET=true` on local dev.
9. **TEMPLATES**: Exactly 4 system templates exist and are registered (`general-sales`, `real-estate`, `healthcare`, `education`). Do not fabricate or claim 7 templates.
10. **PHASE-LOCK MANDATORY VERIFICATION**: `npm test`, `npm run build`, and `npm run deploy:prepare` execute `check:phase-lock` prior to execution.
