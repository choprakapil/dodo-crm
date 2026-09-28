# Feature Contract: Follow-ups & Task Scheduling (Slice 4)

**Status:** APPROVED & LOCKED  
**Module:** `tasks`, `activities`  
**Version:** 1.0  
**Target Scale:** 1,000+ companies / 1,000,000+ leads / high-volume task scheduling  

---

## 1. Actors & Data Scope Permissions
- **Tenant Admin:** `COMPANY` data scope across tasks (`manage`). Can view, schedule, update, complete, and delete all tenant follow-up tasks.
- **Manager:** `TEAM` data scope across tasks (`view`, `create`, `update`, `delete`, `assign`). Can schedule and reassign follow-ups for team members and view team follow-ups.
- **Sales Rep / Employee:** `OWN` data scope across tasks (`view`, `create`, `update`). Can schedule follow-ups for themselves or assigned leads, view their own pending/completed tasks, and complete them.
- **Support / Viewer:** Read-only (`COMPANY` scope) or scoped interaction.

---

## 2. Preconditions & Tenant Isolation
- User must possess a valid, non-expired database-backed session cookie (`universal_crm_session`).
- User must belong to an `ACTIVE` company.
- Tenant context is strictly derived from the validated server-side `AuthContext`.
- Client-supplied `companyId`, `tenantId`, `userId`, `id`, `createdAt`, `completedAt` are rejected and sanitized.
- Inaccessible foreign tenant records (or tasks belonging to other companies) return HTTP 404 (`NotFoundError`) to prevent information leakage.
- Foreign entity references (`leadId`, `assignedUserId`, `teamId`) are validated to ensure they belong exclusively to the active company before any write operation is permitted.

---

## 3. End-to-End User Flows

### A. Scheduling a Follow-up Task
1. Actor clicks `[+ Follow-up]` on Lead Detail page (`/app/leads/:id`) or within Follow-up Workspace (`/app/follow-ups`).
2. Fills Title, optional description, Due Date, Due Time, Priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), and Assignee (defaults to current user or lead assignee).
3. Submits `POST /api/v1/follow-ups`.
4. Server validates foreign keys (`leadId`, `assignedUserId`, `teamId`) belong to the tenant.
5. Creates `Task` with `status: PENDING`, logs `TASK_CREATED` on the associated lead timeline, and generates `task.create` in `AuditLog`.

### B. Follow-up Workspace (`/app/follow-ups`)
1. Actor navigates to `/app/follow-ups` from the top navigation bar.
2. Workspace presents quick tab filters:
   - `Today`: Due on the current calendar date in the company timezone.
   - `Overdue`: Due prior to today and still `PENDING`.
   - `Upcoming`: Due after today and still `PENDING`.
   - `All Follow-ups`: Unfiltered list.
   - `Completed`: Historical tasks with `status: COMPLETED`.
   - `Cancelled`: Tasks marked `CANCELLED`.
3. Live text search queries titles, descriptions, and associated lead names.
4. Filter by priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) and assignment.
5. Server-side pagination with total count and page boundary controls.

### C. Quick-Completing a Follow-up
1. Actor clicks the checkmark `[Complete]` button on any pending follow-up in the workspace table or lead detail view.
2. Client issues `POST /api/v1/follow-ups/:id/complete`.
3. Server verifies permissions (`tasks.update`), updates `status: COMPLETED`, sets `completedAt: new Date()` and `completedById: AuthContext.user.id`.
4. Automatically records `TASK_COMPLETED` on the associated lead timeline.
5. Emits `task.complete` audit log entry.
6. The task is instantly updated in the UI and moved to the Completed tab.

### D. Updating / Reassigning a Follow-up
1. Actor issues `PATCH /api/v1/follow-ups/:id` with updated title, dueAt, priority, or assignedUserId.
2. Server validates assignee belongs to the company, verifies data scope, and updates the task.
3. Automatically creates `TASK_UPDATED` or re-assignment record and audit log.

### E. Deleting a Follow-up
1. Actor issues `DELETE /api/v1/follow-ups/:id`.
2. Server enforces `tasks.delete` permission and data scope.
3. Task is deleted, a `TASK_DELETED` timeline activity is preserved on the lead history, and `task.delete` audit entry is logged.

---

## 4. API Endpoints
- `GET /api/v1/follow-ups` — List follow-ups with filters (`dueFilter`, `priority`, `status`, `assignedUserId`, `search`, `page`, `limit`)
- `POST /api/v1/follow-ups` — Schedule a new follow-up task
- `GET /api/v1/follow-ups/:id` — Retrieve follow-up details
- `PATCH /api/v1/follow-ups/:id` — Update follow-up details, due date, priority, or status
- `DELETE /api/v1/follow-ups/:id` — Delete follow-up task
- `POST /api/v1/follow-ups/:id/complete` — Mark follow-up as completed with actor attribution
