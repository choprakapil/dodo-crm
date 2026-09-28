[STATE]

# API Contracts

## Auth API (`/api/v1/auth/*`) — Slice 2

### 1. `POST /api/v1/auth/login`
- **Description:** Authenticate user credentials and establish a database-backed session with HTTP-only cookie.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "companySlug": "optional-company-slug"
  }
  ```
- **Responses:**
  - `200 OK`: Sets cookie `universal_crm_session`
    ```json
    {
      "success": true,
      "data": {
        "user": { "id": "...", "email": "...", "name": "...", "phone": null, "role": { "id": "...", "name": "Admin" } },
        "company": { "id": "...", "name": "Acme Corp", "slug": "acme-corp" }
      }
    }
    ```
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Invalid email or password
  - `403 Forbidden`: Account disabled, unactivated invitation, or company suspended
  - `429 Too Many Requests`: Rate limit exceeded

### 2. `POST /api/v1/auth/logout`
- **Description:** Revoke current session in database and clear session cookie.
- **Request:** Empty body + `Cookie: universal_crm_session=...`
- **Responses:**
  - `200 OK`: Clears cookie (`Max-Age=0`)
    ```json
    { "success": true, "message": "Successfully logged out." }
    ```

### 3. `GET /api/v1/auth/me`
- **Description:** Retrieve currently authenticated identity and tenant context.
- **Request:** Headers with `Cookie: universal_crm_session=...`
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "user": { "id": "...", "email": "...", "name": "...", "phone": null, "status": "ACTIVE", "roleId": "...", "roleName": "Admin", "isSystemRole": true },
        "company": { "id": "...", "name": "Acme Corp", "slug": "acme-corp", "status": "ACTIVE", "timezone": "UTC", "currency": "USD" },
        "role": { "id": "...", "name": "Admin", "isSystem": true },
        "permissions": [
          { "module": "leads", "action": "manage", "dataScope": "COMPANY" }
        ]
      }
    }
    ```
  - `401 Unauthorized`: No active valid session

### 4. `POST /api/v1/auth/forgot-password`
- **Description:** Request password reset instructions.
- **Request Body:**
  ```json
  { "email": "user@example.com" }
  ```
- **Responses:**
  - `200 OK`: (Generic message to prevent enumeration)
    ```json
    { "success": true, "message": "If an account with that email exists, instructions have been sent to reset your password." }
    ```
  - `400 Bad Request`: Invalid email format
  - `429 Too Many Requests`: Rate limit exceeded

### 5. `POST /api/v1/auth/reset-password`
- **Description:** Reset password using single-use reset token.
- **Request Body:**
  ```json
  {
    "token": "32-byte-base64url-token",
    "password": "NewStrongPassword123!"
  }
  ```
- **Responses:**
  - `200 OK`:
    ```json
    { "success": true, "message": "Password has been successfully reset. Please sign in with your new password." }
    ```
  - `400 Bad Request`: Invalid/expired/reused token or weak password
  - `429 Too Many Requests`: Rate limit exceeded

---

## Leads API (`/api/v1/leads/*`) — Slice 3

### 6. `GET /api/v1/leads`
- **Description:** List leads for the authenticated tenant with filtering, search, pagination, and data-scope enforcement.
- **Authentication:** Required (DB session cookie)
- **Permission:** `leads.view`
- **Data Scope:** Evaluates `OWN`, `TEAM`, `COMPANY`, `PLATFORM`.
- **Query Parameters:**
  - `page` (integer, default: 1)
  - `limit` (integer, default: 20, max: 100)
  - `search` (string, optional: matches name, email, phone, company)
  - `statusId` (string, optional)
  - `sourceId` (string, optional)
  - `priority` (enum: `LOW`, `MEDIUM`, `HIGH`, `URGENT`, optional)
  - `assignedUserId` (string, optional)
  - `teamId` (string, optional)
  - `sortBy` (enum: `createdAt`, `updatedAt`, `name`, `amount`, `priority`, default: `createdAt`)
  - `sortOrder` (enum: `asc`, `desc`, default: `desc`)
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "cuid",
          "name": "Jane Doe",
          "email": "jane@example.com",
          "phone": "+1 555-0199",
          "company": "Acme Partners",
          "amount": 15000.0,
          "priority": "HIGH",
          "status": { "id": "...", "name": "New", "color": "#6366f1" },
          "source": { "id": "...", "name": "Website" },
          "assignedUser": { "id": "...", "name": "Alice", "email": "alice@test.com" },
          "team": { "id": "...", "name": "Sales Team" }
        }
      ],
      "pagination": {
        "page": 1,
        "pageSize": 20,
        "total": 51,
        "totalPages": 3,
        "hasPreviousPage": false,
        "hasNextPage": true
      }
    }
    ```
  - `400 Bad Request`: Invalid query parameters
  - `401 Unauthorized`: No active session
  - `403 Forbidden`: Lacks `leads.view` permission

### 7. `POST /api/v1/leads`
- **Description:** Create a new lead for the authenticated tenant with automatic status assignment, history recording, activity entry, and audit log.
- **Authentication:** Required (DB session cookie)
- **Permission:** `leads.create`
- **Data Scope:** Enforced via AuthContext.
- **Request Body:**
  ```json
  {
    "name": "Alex Morgan",
    "email": "alex@example.com",
    "phone": "+1 555-0123",
    "company": "Enterprise Corp",
    "amount": 50000,
    "priority": "HIGH",
    "statusId": "optional_status_id",
    "sourceId": "optional_source_id",
    "assignedUserId": "optional_user_id",
    "teamId": "optional_team_id"
  }
  ```
- **Responses:**
  - `201 Created`: Returns created lead with hydrated relations
  - `400 Bad Request`: Validation error or invalid foreign key (cross-tenant status/source/user/team)
  - `401 Unauthorized`: No active session
  - `403 Forbidden`: Lacks `leads.create` permission

### 8. `GET /api/v1/leads/:id`
- **Description:** Retrieve full details of a single lead, including status histories, assignment histories, and activity timeline.
- **Authentication:** Required (DB session cookie)
- **Permission:** `leads.view`
- **Responses:**
  - `200 OK`: Lead object with `statusHistories`, `assignmentHistories`, and `activities`
  - `401 Unauthorized`: No active session
  - `403 Forbidden`: Lacks permission or outside data scope
  - `404 Not Found`: Lead does not exist, belongs to another company, is soft-deleted, or is outside user data scope

### 9. `PATCH /api/v1/leads/:id`
- **Description:** Update lead metadata, transition status (with history), or reassign (with history).
- **Authentication:** Required (DB session cookie)
- **Permission:** `leads.update` (`leads.assign` required for reassignment)
- **Responses:**
  - `200 OK`: Returns updated lead
  - `400 Bad Request`: Validation error or foreign key violation
  - `401 Unauthorized`: No active session
  - `403 Forbidden`: Lacks update/assign permission
  - `404 Not Found`: Lead does not exist or belongs to another company

### 10. `DELETE /api/v1/leads/:id`
- **Description:** Soft-delete a lead (`deletedAt: new Date()`).
- **Authentication:** Required (DB session cookie)
- **Permission:** `leads.delete`
- **Responses:**
  - `200 OK`: `{ "success": true, "message": "Lead deleted successfully" }`
  - `401 Unauthorized`: No active session
  - `403 Forbidden`: Lacks `leads.delete` permission
  - `404 Not Found`: Lead does not exist or belongs to another company

### 11. `GET /api/v1/leads/config`
- **Description:** Retrieve company-scoped lead statuses, sources, users, and teams for dropdown selections.
- **Authentication:** Required (DB session cookie)
- **Responses:**
  - `200 OK`: `{ "success": true, "data": { "statuses": [...], "sources": [...], "users": [...], "teams": [...] } }`
  - `401 Unauthorized`: No active session

### 12. `GET /api/v1/leads/:id/activities`
- **Description:** Retrieve paginated activity feed and interactions for a lead.
- **Authentication:** Required (DB session cookie)
- **Permission:** `activities.view`
- **Responses:**
  - `200 OK`: `{ "success": true, "data": [...], "pagination": { "page": 1, "limit": 50, "total": 12, "totalPages": 1 } }`
  - `401 Unauthorized`: No active session
  - `404 Not Found`: Lead does not exist or outside tenant/data scope

### 13. `POST /api/v1/leads/:id/activities`
- **Description:** Log an interaction (CALL, WHATSAPP, EMAIL, NOTE, MEETING) against a lead.
- **Authentication:** Required (DB session cookie)
- **Permission:** `activities.create`
- **Request Body:**
  ```json
  {
    "type": "CALL",
    "subject": "Follow-up phone call",
    "description": "Client requested proposal revision",
    "metadata": { "duration": 15 }
  }
  ```
- **Responses:**
  - `201 Created`: Activity object
  - `400 Bad Request`: Validation error
  - `404 Not Found`: Lead not found or foreign tenant

### 14. `GET /api/v1/follow-ups`
- **Description:** Query and list follow-up tasks with filter tabs (`dueFilter: today | overdue | upcoming | all | completed | cancelled`), priority, assignee, search, and pagination.
- **Authentication:** Required (DB session cookie)
- **Permission:** `tasks.view`
- **Query Parameters:** `page`, `limit`, `dueFilter`, `priority`, `status`, `assignedUserId`, `search`
- **Responses:**
  - `200 OK`: `{ "success": true, "data": [...], "pagination": { ... } }`
  - `401 Unauthorized`: No active session

### 15. `POST /api/v1/follow-ups`
- **Description:** Schedule a follow-up task.
- **Authentication:** Required (DB session cookie)
- **Permission:** `tasks.create`
- **Request Body:**
  ```json
  {
    "title": "Send updated quotation",
    "description": "Include volume discount options",
    "dueAt": "2026-09-20T10:00:00.000Z",
    "priority": "HIGH",
    "leadId": "lead_cuid",
    "assignedUserId": "user_cuid"
  }
  ```
- **Responses:**
  - `201 Created`: Created follow-up task with creator and assignee relations
  - `400 Bad Request`: Validation error or foreign entity reference
  - `401 Unauthorized`: No active session

### 16. `POST /api/v1/follow-ups/:id/complete`
- **Description:** Mark a follow-up task as completed with actor attribution.
- **Authentication:** Required (DB session cookie)
- **Permission:** `tasks.update`
- **Responses:**
  - `200 OK`: Updated task object with `status: "COMPLETED"`, `completedAt`, `completedBy`
  - `401 Unauthorized`: No active session
  - `404 Not Found`: Task not found or foreign tenant

## Custom Fields API (`/api/v1/custom-fields/*`) — Slice 5

### 17. `GET /api/v1/custom-fields`
- **Description:** List custom fields for the company.
- **Query Parameters:** `entityType` (default: `LEAD`), `includeInactive` (boolean).
- **Responses:** `200 OK` with custom field definitions array.

### 18. `POST /api/v1/custom-fields`
- **Description:** Create custom field definition.
- **Permission:** `custom_fields:create` or `settings:manage`.
- **Request Body:** `{ entityType, key, label, description?, fieldType, required?, active?, sortOrder?, options? }`
- **Responses:** `201 Created` with custom field record.

### 19. `PATCH /api/v1/custom-fields/:id`
- **Description:** Update label, description, required, active, or options of custom field.
- **Permission:** `custom_fields:manage` or `settings:manage`.
- **Responses:** `200 OK`.

### 20. `DELETE /api/v1/custom-fields/:id`
- **Description:** Soft-delete custom field (`deletedAt: now`, `active: false`).
- **Permission:** `custom_fields:manage` or `settings:manage`.
- **Responses:** `200 OK`.

### 21. `POST /api/v1/custom-fields/reorder`
- **Description:** Atomically update `sortOrder` for multiple custom fields.
- **Request Body:** `{ items: [{ id, sortOrder }] }`
- **Responses:** `200 OK`.

### 22. `GET /api/v1/leads/:id/custom-fields`
- **Description:** Retrieve active custom fields for lead paired with their saved values.
- **Responses:** `200 OK` with `[{ field: CustomField, value: unknown }]`.

### 23. `PATCH /api/v1/leads/:id/custom-fields`
- **Description:** Save or update custom field values on a lead.
- **Request Body:** `{ values: { [customFieldIdOrKey]: value } }`
- **Responses:** `200 OK`.

## Lead Import / Export API (`/api/v1/leads/*`) — Slice 5

### 24. `POST /api/v1/leads/import/preview`
- **Description:** Upload CSV, detect headers, return auto-mappings and sample rows.
- **Request Body:** `{ csvContent: string, filename?: string }`
- **Responses:** `200 OK` with `{ detectedHeaders, suggestedMappings, totalRows, sampleRows, availableFields }`.

### 25. `POST /api/v1/leads/import`
- **Description:** Execute batch lead import with duplicate handling and custom fields.
- **Request Body:** `{ csvContent, filename, columnMappings, duplicateStrategy: "SKIP" | "UPDATE" | "CREATE" }`
- **Responses:** `200 OK` with `{ id, status, totalRows, successfulRows, skippedRows, updatedRows, failedRows, errorSummary }`.

### 26. `GET /api/v1/leads/imports`
- **Description:** List past lead import jobs with row counts and status.
- **Responses:** `200 OK` with paginated `LeadImport` records.

### 27. `GET /api/v1/leads/imports/:id`
- **Description:** Detail of import job with row-level error breakdown.
- **Responses:** `200 OK`.

### 28. `GET /api/v1/leads/export`
- **Description:** Export tenant leads to CSV according to filters and user data scope, including active custom fields and spreadsheet formula injection protection.
- **Query Parameters:** `search`, `statusId`, `sourceId`, `priority`, `assignedUserId`, `teamId`.
- **Responses:** `200 OK` with `Content-Type: text/csv` and `Content-Disposition: attachment; filename=...`.

## Reports & Analytics API (`/api/v1/analytics/*`) — Slice 6

### 29. `GET /api/v1/analytics/overview`
- **Description:** Retrieve consolidated metrics for executive dashboard including KPI cards with comparison deltas, lead trend time-series chart points, status distribution, source distribution, pipeline funnel overview, multichannel activity counts, follow-up health, and scoped team performance leaderboard.
- **Permission:** Requires `reports:view` permission.
- **Query Parameters:**
  - `preset`: `TODAY` | `YESTERDAY` | `LAST_7_DAYS` | `LAST_30_DAYS` (default) | `THIS_MONTH` | `LAST_MONTH` | `THIS_QUARTER` | `THIS_YEAR` | `CUSTOM`
  - `startDate`: ISO-8601 string (required when preset is `CUSTOM`)
  - `endDate`: ISO-8601 string (required when preset is `CUSTOM`)
  - `teamId`: Optional UUID (for Managers/Admins to filter by team)
  - `userId`: Optional UUID (for Admins/Managers to filter by agent)
- **Headers:** `Cache-Control: no-store, no-cache, must-revalidate`
- **Responses:**
  - `200 OK`:
    ```json
    {
      "success": true,
      "data": {
        "dateRange": { "preset": "LAST_30_DAYS", "startDate": "...", "endDate": "...", "comparisonStartDate": "...", "comparisonEndDate": "..." },
        "kpis": {
          "totalLeads": { "value": 100, "previousValue": 80, "changePercent": 25.0 },
          "newLeads": { "value": 45, "previousValue": 30, "changePercent": 50.0 },
          "convertedLeads": { "value": 12, "previousValue": 8, "changePercent": 50.0 },
          "conversionRate": { "value": 12.0, "previousValue": 10.0, "changePercent": 20.0 },
          "pipelineValue": { "value": 350000, "previousValue": 280000, "changePercent": 25.0 },
          "followUpsDue": { "value": 5, "previousValue": 10, "changePercent": -50.0 }
        },
        "leadTrend": [
          { "date": "2026-09-01", "label": "Sep 01", "created": 4, "converted": 1 }
        ],
        "statusBreakdown": [
          { "statusId": "...", "name": "New", "color": "#3B82F6", "count": 25, "percentage": 25.0, "value": 120000 }
        ],
        "sourceBreakdown": [
          { "sourceId": "...", "name": "Website", "count": 40, "percentage": 40.0, "value": 200000 }
        ],
        "pipelineOverview": {
          "totalPipelineValue": 350000,
          "wonRevenue": 150000,
          "lostValue": 50000,
          "activeDealsCount": 65,
          "wonDealsCount": 12,
          "lostDealsCount": 8,
          "winRate": 60.0,
          "avgDealSize": 5384.62,
          "stages": [
            { "stage": "ACTIVE", "label": "Active Pipeline", "count": 65, "value": 350000, "percentage": 76.5 }
          ]
        },
        "activityMetrics": {
          "totalActivities": 120,
          "calls": 45,
          "whatsApp": 30,
          "emails": 25,
          "meetings": 10,
          "notes": 10
        },
        "followUpMetrics": {
          "total": 50,
          "completed": 40,
          "pending": 8,
          "overdue": 2,
          "completionRate": 80.0
        },
        "teamPerformance": [
          {
            "userId": "...",
            "name": "Sarah Rep",
            "email": "sarah@acme.test",
            "avatarUrl": null,
            "teamName": "Outbound",
            "leadsCount": 25,
            "wonCount": 5,
            "pipelineValue": 125000,
            "activitiesCount": 35,
            "followUpsCompleted": 18,
            "conversionRate": 20.0
          }
        ]
      }
    }
    ```
  - `400 Bad Request`: Invalid date range or custom span exceeding 730 days.
  - `401 Unauthorized`: Missing or invalid session.
  - `403 Forbidden`: User lacks `reports:view` permission.

### 30. `GET /api/v1/analytics/export`
- **Description:** Export reports data as a formula-sanitized CSV file download with audit logging.
- **Permission:** Requires `reports:export` or `reports:view` permission.
- **Query Parameters:**
  - `type`: `team_performance` | `pipeline_summary` (default: `team_performance`)
  - `preset`, `startDate`, `endDate`, `teamId`, `userId` (same as overview)
- **Responses:**
  - `200 OK`: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="team_performance_report_...csv"`




