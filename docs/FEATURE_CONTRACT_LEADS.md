[STATE]

# Feature Contract: Lead Management Core (Slice 3)

**Status:** APPROVED & LOCKED  
**Module:** `leads`  
**Version:** 1.0  
**Target Scale:** 1,000+ companies / 1,000,000+ leads  

---

## 1. Actors
- **Super Admin:** System-wide platform supervisor.
- **Tenant Admin:** Full read/write/delete/assign control across the tenant (`COMPANY` data scope).
- **Manager:** Team-level operational lead (`TEAM` data scope: sees/manages leads for self and assigned team members).
- **Sales Rep / Employee:** Individual contributor (`OWN` data scope: sees/updates only leads assigned to self; cannot delete).
- **Viewer / Support:** Read-only or read/update access with defined data scopes.

---

## 2. Preconditions
- User must possess a valid, non-expired DB-backed session cookie (`universal_crm_session`).
- User must belong to an `ACTIVE` company.
- Tenant context is strictly derived from the validated server-side session.
- Client-supplied `companyId` is rejected / ignored.

---

## 3. End-to-End User Flows

### A. Lead Creation
1. Actor navigates to `/app/leads`.
2. Clicks "New Lead" button to open `CreateLeadDialog`.
3. Fills in Name (required), Email, Phone, Company, Deal Amount, Priority, Status (default selected), Source, Assignee, Team.
4. Client validates inputs and POSTs to `/api/v1/leads`.
5. Server validates foreign keys belong to tenant, creates `Lead` record in an atomic transaction with:
   - Initial `LeadStatusHistory`
   - Initial `LeadAssignmentHistory` (if assigned)
   - `Activity` entry (`LEAD_CREATED`)
   - `AuditLog` entry (`lead.create`)
6. Table refreshes and displays the newly created lead.

### B. Lead Listing, Searching & Filtering
1. Actor visits `/app/leads`.
2. Server component reads query params (`page`, `limit`, `search`, `statusId`, `sourceId`, `priority`).
3. Evaluates actor's data scope (`OWN`, `TEAM`, `COMPANY`).
4. Executes tenant-isolated query with composite index ordering (`[companyId, createdAt(Desc)]`).
5. Returns paginated response with counts and records.
6. User can filter or search across name, email, phone, and company with instant reactive updates.

### C. Lead Detail, History & Timeline
1. Actor clicks on a lead name or view button.
2. Server loads lead by ID: verifies tenant match and data scope.
3. If foreign tenant or soft-deleted: returns 404 (`NotFoundError`).
4. Hydrates relations, status history, assignment history, and activity timeline.
5. Displays overview metrics, ownership metadata, and interactive tabs.

### D. Inline Status Transition & Reassignment
1. From table or detail view, actor changes status dropdown.
2. Client issues `PATCH /api/v1/leads/:id` with `{ statusId }`.
3. Server verifies permission, checks status belongs to company, records `LeadStatusHistory`, logs `STATUS_CHANGED` activity.
4. Reassignment issues `PATCH /api/v1/leads/:id` with `{ assignedUserId }`.
5. Server checks `leads.assign` permission, verifies user belongs to tenant, records `LeadAssignmentHistory`, logs `REASSIGNED` activity.

### E. Soft Delete
1. Actor clicks delete icon; opens confirmation dialog.
2. Client sends `DELETE /api/v1/leads/:id`.
3. Server checks `leads.delete` permission; updates `deletedAt: new Date()`.
4. Records `LEAD_DELETED` activity and audit log.
5. Lead is immediately excluded from subsequent queries and direct ID lookups return 404.

---

## 4. Database Schema & Index Design
- **Table:** `leads` (mapped to `leads`)
- **Foreign Keys:**
  - `companyId` -> `companies(id)` (ON DELETE CASCADE)
  - `sourceId` -> `lead_sources(id)`
  - `statusId` -> `lead_statuses(id)`
  - `assignedUserId` -> `users(id)`
  - `teamId` -> `teams(id)`
- **Composite Indexes (Scale Target 1M+):**
  - `[companyId]`
  - `[companyId, statusId]`
  - `[companyId, sourceId]`
  - `[companyId, assignedUserId]`
  - `[companyId, teamId]`
  - `[companyId, priority]`
  - `[companyId, createdAt(Desc)]`
  - `[companyId, deletedAt]`
- **History Tables:**
  - `lead_status_histories` (captures `fromStatusId`, `toStatusId`, `changedById`, `changedAt`)
  - `lead_assignment_histories` (captures `fromUserId`, `toUserId`, `assignedById`, `assignedAt`)
  - `activities` (drives timeline)

---

## 5. Security & Isolation Matrix
| Attack Vector | Countermeasure | Expected Result |
|---|---|---|
| Cross-tenant IDOR read | Tenant-scoped `findFirst({ where: { id, companyId } })` | 404 Not Found |
| Cross-tenant IDOR update | Tenant check before update in transaction | 404 Not Found |
| Cross-tenant IDOR delete | Tenant check before soft delete | 404 Not Found |
| Foreign statusId injection | Validation query checking `status.companyId === ctx.company.id` | 400 Validation Error |
| Foreign sourceId injection | Validation query checking `source.companyId === ctx.company.id` | 400 Validation Error |
| Foreign assignee injection | Validation query checking `user.companyId === ctx.company.id` | 400 Validation Error |
| Mass assignment (`companyId`) | Strict Zod schema ignores client `companyId`; server binds `ctx.company.id` | Cannot alter tenant |
| Soft-deleted bypass | `deletedAt: null` enforced in all select queries | 404 Not Found |

---

## 6. Data Scope Policy
- `COMPANY` / `PLATFORM`: Empty filter `{}` within company.
- `TEAM`: Memberships queried from `team_members`; filter: `{ OR: [{ assignedUserId: ctx.user.id }, { teamId: { in: teamIds } }] }`.
- `OWN`: Filter: `{ assignedUserId: ctx.user.id }`.
- No hardcoded role strings; evaluations derived directly from `ctx.getDataScope("leads", action)`.

---

## 7. Verification Evidence
- **Unit Tests:** `tests/lead-unit.test.ts` (Validations, normalizations, data-scope generator) -> PASS.
- **Integration Tests:** `tests/lead-integration.test.ts` (CRUD, status transitions, assignments, soft-delete) -> PASS.
- **Tenant Security Tests:** `tests/lead-tenant-security.test.ts` (Cross-tenant IDOR, foreign FK injection, mass assignment) -> PASS.
- **Spectator Adversarial Tests:** `tests/lead-spectator.test.ts` (Sarah OWN scope, Manager TEAM scope, Admin COMPANY scope, tamper resistance) -> PASS.
- **HTTP Live E2E Tests:** `tests/http-e2e.test.ts` (Live server API calls, cookie auth, error status codes) -> PASS.
