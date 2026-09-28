# Feature Contract: Activities & Follow-ups (Slice 4)

**Status:** APPROVED & LOCKED  
**Module:** `activities`, `tasks`  
**Version:** 1.0  
**Target Scale:** 1,000+ companies / 1,000,000+ leads / high-volume activity logging  

---

## 1. Actors & Data Scope Permissions
- **Tenant Admin:** `COMPANY` data scope across activities and tasks (`manage`). Can view, create, update, complete, and delete all tenant activities and follow-ups.
- **Manager:** `TEAM` data scope across activities and tasks (`view`, `create`, `update`, `delete`, `assign`). Can interact with activities and follow-ups for team members and team leads.
- **Sales Rep / Employee:** `OWN` data scope across activities and tasks (`view`, `create`, `update`). Can schedule and manage follow-ups for self or assigned leads.
- **Support / Viewer:** Read-only (`COMPANY` scope) or scoped interaction.

---

## 2. Preconditions & Tenant Isolation
- User must possess a valid, non-expired database-backed session cookie (`universal_crm_session`).
- User must belong to an `ACTIVE` company.
- Tenant context is strictly derived from the validated server-side `AuthContext`.
- Client-supplied `companyId`, `tenantId`, `userId`, `id`, `createdAt`, `completedAt` are rejected and sanitized.
- Inaccessible foreign tenant records or soft-deleted leads return HTTP 404 (`NotFoundError`) to prevent information leakage.

---

## 3. End-to-End User Flows

### A. Activity Logging (Call, WhatsApp, Email, Note, Meeting)
1. Actor navigates to Lead Detail page (`/app/leads/:id`).
2. Clicks `[+ Activity]` button to open `LogActivityDialog`.
3. Selects activity type (`CALL`, `WHATSAPP`, `EMAIL`, `NOTE`, `MEETING`).
4. Enters optional Subject and mandatory details/notes.
5. Issues `POST /api/v1/leads/:id/activities`.
6. Server enforces lead belongs to `AuthContext.company.id` and validates data scope.
7. Creates `Activity` and `AuditLog` records atomically.
8. Activity immediately appears in chronological timeline with specialized type icon, badge, and actor information.

### B. Scheduling a Follow-up Task
1. Actor clicks `[+ Follow-up]` on Lead Detail page or within Follow-up Workspace.
2. Selects Title, optional description, Due Date, Due Time, Priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), and Assignee.
3. Issues `POST /api/v1/follow-ups`.
4. Server validates foreign keys (`leadId`, `assignedUserId`, `teamId`) belong to the tenant.
5. Creates `Task` with `status: PENDING`, logs `TASK_CREATED` on the associated lead timeline, and generates `AuditLog`.

### C. Follow-up Workspace (`/app/follow-ups`)
1. Actor navigates to `/app/follow-ups` from the top navigation bar.
2. Workspace presents tab filters: `Today`, `Overdue`, `Upcoming`, `All Follow-ups`, `Completed`, `Cancelled`.
3. Full search across titles, descriptions, and associated lead names.
4. Server-side pagination with count and page boundary controls.
5. Quick action `[Complete]` triggers `POST /api/v1/follow-ups/:id/complete`:
   - Updates `status: COMPLETED`, records `completedAt: now` and `completedById: AuthContext.user.id`.
   - Records `TASK_COMPLETED` on lead timeline.
   - Logs `FOLLOWUP_COMPLETED` in `AuditLog`.

---

## 4. API Endpoints
- `GET /api/v1/leads/:id/activities` — Paginated lead activities
- `POST /api/v1/leads/:id/activities` — Record activity on lead
- `GET /api/v1/activities/:id` — Get activity
- `PATCH /api/v1/activities/:id` — Update activity
- `DELETE /api/v1/activities/:id` — Delete activity
- `GET /api/v1/follow-ups` — List follow-ups with filters (`dueFilter`, `priority`, `status`, `assignedUserId`, `search`)
- `POST /api/v1/follow-ups` — Schedule follow-up
- `GET /api/v1/follow-ups/:id` — Get follow-up details
- `PATCH /api/v1/follow-ups/:id` — Update follow-up details or assignment
- `DELETE /api/v1/follow-ups/:id` — Delete follow-up
- `POST /api/v1/follow-ups/:id/complete` — Quick complete follow-up
