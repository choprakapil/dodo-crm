# CRM SaaS V1 — Production Readiness Addendum
Version: 1.1
Status: Required companion to the Product Requirements Document

This addendum closes implementation ambiguities that can otherwise cause incomplete, insecure, or non-scalable V1 delivery. It does not replace the existing PRD; where there is a conflict, the conflict must be raised as a decision item before implementation.

---

## 1. Source-of-Truth Hierarchy

Use this precedence order:

1. Approved Product Requirements Document
2. Approved architecture and ADRs
3. Database schema and migration contracts
4. API contracts / OpenAPI
5. Design system and approved UX decisions
6. Feature specifications
7. Implementation
8. Tests, runtime evidence, and spectator evidence

Agents must not silently resolve contradictions. They must create a decision record.

---

## 2. Feature Contract — Mandatory for Every V1 Feature

Every feature must have:

- Feature ID and name
- Purpose
- Actors
- Preconditions
- User flow
- UI states
- API endpoints
- Request/response validation
- Database entities and constraints
- Permission requirements
- Tenant scope
- Data scope: OWN / TEAM / COMPANY / PLATFORM
- Loading / empty / error states
- Audit/activity requirements
- Security requirements
- Performance considerations
- Test cases
- Acceptance criteria
- Definition of Done

A feature is not complete because its screen exists.

---

## 3. Tenant Isolation Contract

Every authenticated request must resolve:

`Request → Authentication → Identity Context → Tenant Context → Permission Context → Data Scope → Service → Repository → Database`

Rules:

- Deny by default.
- Never trust `company_id` supplied by the browser.
- Derive tenant identity from authenticated context.
- Every company-owned query must be tenant-scoped.
- Every resource lookup must validate tenant ownership.
- Every OWN/TEAM/COMPANY rule must be enforced server-side.
- Cross-tenant access tests are mandatory for every tenant-owned resource.
- Super Admin access is a separate PLATFORM scope and must be explicitly authorized and audited.

---

## 4. IDOR / Resource Authorization

For every resource access, verify all applicable layers:

1. Authenticated user
2. Active user/company state
3. Permission
4. Tenant ownership
5. Data scope
6. Resource state/action rules

An opaque or valid database ID is never proof of authorization.

---

## 5. Roles and Permission Model

V1 roles:

- Company Owner
- Company Admin
- Manager
- Employee

Permission checks must be centralized. Avoid scattered ad-hoc role checks.

Permission model should support:

`module.resource.action`

Example:

`leads.view`
`leads.create`
`leads.update`
`leads.delete`
`leads.assign`
`users.manage`
`reports.view`

Scope:

`OWN | TEAM | COMPANY | PLATFORM`

Default is deny.

---

## 6. User / Invitation / Session Rules

Define and implement:

- User invitation flow
- Invitation token expiry
- One-time token use
- Resend invitation
- Disabled user behavior
- Password reset token expiry and one-time use
- Password change invalidates other sessions
- Session revocation
- Secure HTTP-only cookies
- CSRF protection where applicable
- Rate limiting for login, reset, invitation and sensitive mutations

If email delivery is required for these flows, V1 must include a transactional email provider abstraction.

---

## 7. Identity Uniqueness

Recommended V1 rule:

`UNIQUE(company_id, normalized_email)`

Email normalization must be consistent.

Company slug must be globally unique.

Phone normalization should use a consistent canonical representation before searching or deduplication.

---

## 8. Lead Data Rules

Define explicitly:

- Required vs optional lead fields
- Email normalization
- Phone normalization
- Duplicate detection behavior
- Assignment to user/team
- Assignment history
- Status transition history
- Source history where required
- Owner vs assignee semantics
- Soft deletion behavior
- Bulk update behavior, if enabled

All lead queries must be server-side filtered and paginated.

For large lead volumes, use indexes based on actual query patterns and consider PostgreSQL trigram indexes for partial text search.

---

## 9. Idempotency and Concurrency

Important mutation endpoints must tolerate retries and accidental duplicate submissions.

Examples:

- Create lead
- Import lead
- Assign lead
- Create task
- Status update
- Invitation

Use idempotency keys where appropriate.

For concurrent edits, use optimistic concurrency using `updated_at` or an explicit version field so stale updates do not silently overwrite newer changes.

---

## 10. API Contract Standard

Every API should have a predictable contract.

Success:

- `data`
- pagination metadata where applicable

Error:

- stable error code
- human-readable message
- field validation details where applicable
- request/correlation ID

Standard HTTP semantics must be used.

Pagination must be consistent.

Authorization must happen before sensitive data is returned.

Maintain an API contract registry containing:

- method
- route
- permission
- tenant scope
- request schema
- response schema
- service
- database dependencies
- tests

If future mobile apps or external integrations are expected, maintain OpenAPI as the contract source.

---

## 11. Database Guardian Requirements

A database review is mandatory for schema-affecting changes.

Check:

- tenant/company foreign keys
- unique constraints
- nullability
- indexes
- foreign-key behavior
- delete/cascade behavior
- migration safety
- destructive changes
- N+1 risks
- query plans for important paths
- large-table pagination
- audit immutability where required

No destructive production migration without explicit authorization and rollback/restore planning.

---

## 12. Security Red-Team Requirements

Security review must cover:

- cross-tenant access
- IDOR
- privilege escalation
- role/scope bypass
- mass assignment
- session abuse
- password reset abuse
- invitation abuse
- rate-limit bypass
- SQL/injection risks
- XSS
- CSRF where applicable
- unsafe file uploads
- sensitive data exposure
- insecure direct API access
- unsafe admin actions

High-risk authentication, tenant-isolation, and privilege issues block completion.

---

## 13. CSV Import / Export Decision

The existing PRD treats CSV import/export as optional/recommended.

Decision required before build:

- If V1: include it in the V1 feature inventory and acceptance criteria.
- If not V1: explicitly move it to V1.1.

If large imports are supported, design import as a job-oriented workflow with:

`uploaded → validating → processing → completed / partially_failed / failed`

Include row-level error reporting.

---

## 14. Mobile / Platform Matrix

The PRD should not use only the phrase “mobile usable.”

For V1 explicitly choose:

| Platform | V1 |
|---|---|
| Desktop web | Required |
| Tablet web | Required |
| Mobile browser | Required / define supported flows |
| Android native app | Not V1 unless separately approved |
| iOS native app | Not V1 unless separately approved |

If native mobile is later added, reuse the API contracts rather than coupling mobile behavior to web-only server components.

---

## 15. Next.js Architecture Rules

Use:

- App Router
- TypeScript strict mode
- Server Components by default
- Client Components only when interaction/browser APIs require them
- Route handlers/API layer for external/API access
- Server Actions only for suitable internal mutations
- Explicit loading/error/not-found boundaries
- Deliberate caching/revalidation decisions
- No unnecessary global client state
- No business authorization implemented only in UI

Data access should be kept behind service/repository boundaries.

---

## 16. Background Jobs and Redis

V1 does not need a distributed queue unless required by actual workload.

However, create an abstraction so future jobs can be moved to Redis/BullMQ or another queue without rewriting business logic.

Do not build Kafka/microservices prematurely.

---

## 17. Observability Contract

Every request should be traceable with:

- request_id / correlation_id
- user_id when authenticated
- company_id when tenant-scoped
- route
- HTTP method
- status
- duration

Logs must not expose passwords, tokens, secrets, or unnecessary sensitive customer data.

Provide:

- health endpoint
- readiness endpoint
- structured application logs
- error tracking integration point

---

## 18. Performance SLOs

Replace vague performance statements with measurable targets where possible.

Initial V1 targets:

- Common authenticated page/API interactions: p95 target under 1 second under normal load
- Critical list APIs: p95 target under 1 second with representative indexes
- No unbounded list queries
- No N+1 on common pages
- Cursor pagination for very large datasets where appropriate
- Aggregate/report queries must be tested with representative data

Load testing should include realistic tenant distributions, not only a single huge company.

---

## 19. Backup / Recovery

Define:

- backup frequency
- retention
- RPO
- RTO
- restore verification
- backup encryption/access control

A backup that has never been restore-tested is not treated as verified recovery capability.

---

## 20. Company and User Lifecycle

Define behavior for:

### Company
- active
- suspended
- archived/deleted

### User
- invited
- active
- disabled

Company suspension must define whether existing sessions are immediately rejected.

User disable must define session invalidation.

---

## 21. Company Configuration vs Platform Configuration

Keep these separate.

Platform configuration:
- global feature flags
- platform security policies
- global defaults
- platform-level integrations

Company configuration:
- lead sources
- statuses
- teams
- roles/permissions
- company preferences
- timezone
- currency
- business settings

---

## 22. Timezone and Date Semantics

Store timestamps in UTC.

Display/report using the company's configured timezone.

Date-based reports must define whether the date boundary is UTC or company-local time. V1 reports should use company-local calendar boundaries.

---

## 23. Audit Log Rules

Audit logs should capture, where applicable:

- actor
- company
- action
- entity type
- entity ID
- timestamp
- relevant before/after summary
- request/correlation ID

Do not expose platform-level audit records to company users.

Sensitive audit information should have controlled retention.

---

## 24. Completion Matrix

A feature cannot be marked COMPLETE until applicable checks are green:

| Gate | Required |
|---|---|
| UI | ✓ |
| API | ✓ |
| Validation | ✓ |
| Authentication | ✓ |
| Authorization | ✓ |
| Tenant isolation | ✓ |
| Data scope | ✓ |
| Database | ✓ |
| Migration | ✓ |
| Loading state | ✓ |
| Empty state | ✓ |
| Error state | ✓ |
| Audit/activity | If applicable |
| Tests | ✓ |
| Runtime verification | ✓ |
| Spectator verification | ✓ |
| Security review | Risk-based |
| Performance review | Risk-based |
| Documentation | ✓ |

---

## 25. No Fake Completion

These are not sufficient by themselves:

- page renders
- TypeScript compiles
- unit tests pass
- API returns 200
- screenshot looks correct

Completion requires evidence that the actual workflow works end-to-end.

The Spectator is an independent verification role and should attempt to disprove completion.

---

## 26. Failure Escalation

Default repair loop:

1. Detect
2. Diagnose
3. Repair
4. Re-test
5. Re-spectate

Maximum automatic repair attempts: 3.

After that, mark the issue `BLOCKED` and record:

- failure
- evidence
- attempted fixes
- likely cause
- recommended human decision

Immediate escalation for:
- tenant isolation failures
- authentication bypass
- privilege escalation
- destructive database risk
- production data loss risk

---

## 27. Environment Matrix

Maintain explicit environment configuration for:

- local
- development
- staging
- production

Document:

- database
- secrets
- debug settings
- logging
- external services
- seed behavior
- migration behavior
- permitted destructive operations

Never run destructive production operations as a normal development step.

---

## 28. CI/CD Gates

Recommended minimum pipeline:

`lint → typecheck → unit tests → integration/API tests → build → migration validation → security checks → deploy → smoke tests`

Production deployment should require successful critical gates.

---

## 29. Onboarding Flow

V1 onboarding should be defined end-to-end:

`Create Company → Company Setup → First Admin → Configure Sources/Statuses → Create/Invite Team → Add/Import Leads → Dashboard`

Avoid creating users, permissions, and configuration flows that leave the administrator in a half-configured state.

---

## 30. Architecture Decision Records

Create an ADR for meaningful architectural choices, such as:

- authentication/session model
- tenant isolation strategy
- authorization strategy
- pagination strategy
- search strategy
- file storage
- email provider
- background job abstraction
- caching
- deployment strategy

Agents should read relevant ADRs before changing architecture.

---

## 31. Agent Topology

Use risk-based invocation:

```text
ORCHESTRATOR
 ├── PROJECT MEMORY
 ├── PLAN INTEGRITY GUARDIAN
 ├── REPOSITORY CARTOGRAPHER
 ├── CHANGE IMPACT ANALYST
 ├── BUILDER
 ├── TEST ORCHESTRATOR
 ├── RUNTIME OBSERVER
 ├── SPECTATOR
 ├── SECURITY RED TEAM
 ├── CONTRACT SENTINEL
 ├── DATABASE GUARDIAN
 └── COMPLETION AUDITOR
```

Do not run every agent for every change.

Examples:

UI change:
`Builder → targeted tests → Spectator`

API change:
`Impact → Builder → Contract Sentinel → Tests → Spectator`

DB change:
`Impact → Builder → Database Guardian → Tests → Spectator`

Auth/security change:
`Impact → Builder → Security Red Team → Contract Sentinel → Tests → Spectator → Completion Auditor`

Architecture change:
`Plan Guardian → Impact → Architecture Review → Builder → full verification`

---

## 32. Recommended Repository Additions

V12 adds/standardizes:

```text
docs/
  PRODUCT_REQUIREMENTS_DOCUMENT.md
  PRD_ENGINEERING_READINESS_ADDENDUM.md
  FEATURE_CONTRACT_TEMPLATE.md
  API_CONTRACT_REGISTRY.md
  ARCHITECTURE_DECISION_RECORDS.md
  ENVIRONMENT_MATRIX.md
  COMPLETION_MATRIX.md
  SECURITY_REVIEW_CHECKLIST.md

agents/
  database-guardian.md
  security-red-team.md
  completion-auditor.md

.harness/
  contracts/
  decisions/
  evidence/
  reviews/
```

---

## 33. Final Build Principle

Build a small V1 with:

- strict tenant isolation
- centralized authorization
- clear contracts
- predictable APIs
- safe database migrations
- measurable performance
- independent runtime verification
- bounded agent context
- evidence-based completion

Do not turn V1 into a microservice platform.

Do not optimize for theoretical scale at the expense of shipping.

Build the modular monolith so that scaling individual hotspots later is possible without rewriting the product.
