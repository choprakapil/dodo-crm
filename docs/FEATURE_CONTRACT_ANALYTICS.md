# Universal CRM — Feature Contract: Reports & Analytics Dashboard (Slice 6)

## 1. Specification Overview

- **Feature Name**: Reports & Analytics Dashboard
- **PRD Reference**: PRD v2.0 FINAL — Section 13 (Basic Reports & Analytics) & Slice 6 Requirements
- **Status**: PRODUCTION READY & VERIFIED
- **Architectural Principle**: Direct PostgreSQL database-level aggregations (`COUNT`, `SUM`, `AVG`, `GROUP BY`, `DATE_TRUNC`) without introducing external BI data warehouses, Redis caches, or event streaming complexity.
- **Tenant & Scoping Model**: Strict multi-tenancy (`ctx.company.id`) with RBAC data scope enforcement (`OWN` for Reps, `TEAM` for Managers, `COMPANY` for Admins) across all metrics, charts, leaderboards, and CSV exports.

---

## 2. Analytics Domain Architecture

```text
lib/
├── services/
│   ├── analytics.service.ts          # Master orchestrator (getOverview, exportReportCsv)
│   └── analytics/
│       ├── types.ts                  # Metric and DTO type definitions
│       ├── date-range.ts             # Preset & custom date bounds with timezone resolution
│       ├── leads.analytics.ts        # Lead counts, time-series trends, velocity
│       ├── pipeline.analytics.ts     # Total value, average deal, stage distribution, won/lost
│       ├── statuses.analytics.ts     # Lead status distribution & values
│       ├── sources.analytics.ts      # Acquisition channels & performance
│       ├── activities.analytics.ts   # Calls, WhatsApp, emails, meetings, notes
│       ├── followups.analytics.ts    # Follow-ups completed, pending, overdue, completion rate
│       └── team.analytics.ts         # Agent performance leaderboard
```

### Performance & Scalability Guarantees:
1. **Zero Client-Side Reduction:** Large datasets are never retrieved into Node.js/browser memory for filtering or aggregation.
2. **Concurrent Database Queries:** `Promise.all` executes independent aggregation queries in parallel.
3. **No N+1 Agent Queries:** The team performance leaderboard uses batched `groupBy` queries on `assignedUserId` and `userId` rather than individual per-user lookups.
4. **Soft-Delete Exclusion:** All queries strictly filter `deletedAt: null`.

---

## 3. Date-Range Presets & Period Comparisons

### Presets:
- `TODAY`: Current day (00:00:00 to 23:59:59.999 UTC)
- `YESTERDAY`: Previous calendar day
- `LAST_7_DAYS`: Rolling past 7 days
- `LAST_30_DAYS`: Rolling past 30 days (default)
- `THIS_MONTH`: First day of current month to current timestamp
- `LAST_MONTH`: Entire previous calendar month
- `THIS_QUARTER`: First day of current quarter to current timestamp
- `THIS_YEAR`: First day of current calendar year to current timestamp
- `CUSTOM`: Validated `from` and `to` ISO timestamps (max range 730 days / 2 years)

### Period Comparison Formula:
For selected period $[T_{start}, T_{end}]$ with duration $\Delta T$:
- **Previous Comparison Window:** $[T_{start} - \Delta T, T_{start} - 1ms]$
- **Zero-Safe Percentage Delta:**
  $$\Delta\% = \begin{cases} 
  0\% & \text{if } \text{prev} = 0 \text{ and } \text{curr} = 0 \\
  +100\% & \text{if } \text{prev} = 0 \text{ and } \text{curr} > 0 \\
  -100\% & \text{if } \text{prev} = 0 \text{ and } \text{curr} < 0 \\
  \frac{\text{curr} - \text{prev}}{|\text{prev}|} \times 100 & \text{otherwise}
  \end{cases}$$

---

## 4. Analytics Security & Multi-Tenancy

Every query derives tenant authority from the authenticated server-side `AuthContext`:
- `companyId: ctx.company.id` is unconditionally applied to all Prisma queries.
- Client-supplied tenant identifiers (`companyId`, tenant headers) are never trusted.
- Foreign ID injections (`teamId`, `userId`, `statusId`, `sourceId`) targeting other companies return 0 results without data leakage.

### Data Scope Enforcement:
- **Sales Rep (`OWN`):**
  - Only sees leads assigned to them.
  - Team performance leaderboard displays exclusively their own row.
  - Only sees follow-ups assigned to or created by them.
- **Manager (`TEAM`):**
  - Sees leads assigned to them or their team members.
  - Team performance leaderboard displays members of their assigned teams.
- **Admin (`COMPANY`):**
  - Sees full company-wide business intelligence and all active company staff.

---

## 5. API Contracts

### 5.1 Overview Endpoint
`GET /api/v1/analytics/overview`

**Query Parameters:**
- `preset`: `TODAY` | `YESTERDAY` | `LAST_7_DAYS` | `LAST_30_DAYS` | `THIS_MONTH` | `LAST_MONTH` | `THIS_QUARTER` | `THIS_YEAR` | `CUSTOM`
- `from`: ISO date string (required if `preset=CUSTOM`)
- `to`: ISO date string (required if `preset=CUSTOM`)
- `teamId`: Optional team filter
- `userId`: Optional agent filter
- `statusId`: Optional status filter
- `sourceId`: Optional source filter

**Response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "kpis": {
      "totalLeads": 120,
      "newLeads": { "current": 42, "previous": 35, "changePercent": 20.0 },
      "convertedLeads": { "current": 8, "previous": 6, "changePercent": 33.3 },
      "conversionRate": { "current": 19.0, "previous": 17.1, "changePercent": 11.1 },
      "pipelineValue": { "current": 450000, "previous": 380000, "changePercent": 18.4 },
      "followUpsDue": { "dueInPeriod": 14, "pending": 11, "overdue": 3 }
    },
    "trends": [
      { "date": "2026-09-01", "label": "Sep 1", "leads": 5 }
    ],
    "statuses": [
      { "id": "status_1", "name": "New", "color": "#6366f1", "count": 25, "percentage": 25.0, "value": 75000 }
    ],
    "sources": [
      { "id": "source_1", "name": "Google Ads", "count": 40, "percentage": 40.0, "value": 120000 }
    ],
    "pipeline": {
      "totalValue": 450000,
      "avgDealValue": 4500,
      "stages": [],
      "convertedValue": 55000,
      "lostValue": 12000
    },
    "velocity": {
      "leadsPerDay": 1.4,
      "leadsPerWeek": 9.8,
      "avgDaysToConvert": 12.5
    },
    "team": [
      {
        "userId": "usr_1",
        "name": "Sarah Rep",
        "email": "sarah@acmecorp.com",
        "roleName": "Sales Rep",
        "assignedLeads": 45,
        "newLeads": 15,
        "convertedLeads": 8,
        "conversionRate": 17.8,
        "pipelineValue": 150000,
        "completedFollowUps": 18,
        "overdueFollowUps": 2,
        "activitiesCount": 35,
        "calls": 15,
        "whatsApp": 12,
        "emails": 6,
        "meetings": 2
      }
    ],
    "activities": {
      "total": 120,
      "byType": { "CALL": 45, "WHATSAPP": 30, "EMAIL": 25, "MEETING": 12, "NOTE": 8 }
    },
    "followUps": {
      "created": 50,
      "completed": 38,
      "pending": 9,
      "overdue": 3,
      "completionRate": 76.0
    }
  },
  "meta": {
    "preset": "LAST_30_DAYS",
    "from": "2026-08-17T00:00:00.000Z",
    "to": "2026-09-16T23:59:59.999Z",
    "previousFrom": "2026-07-18T00:00:00.000Z",
    "previousTo": "2026-08-16T23:59:59.999Z",
    "timezone": "UTC",
    "generatedAt": "2026-09-16T15:20:00.000Z"
  }
}
```

### 5.2 Export Endpoint
`GET /api/v1/analytics/export`

**Query Parameters:**
- `report`: `team` | `statuses` | `sources` | `pipeline` | `activities` (default: `team`)
- `preset`: date preset or `CUSTOM`
- `from`, `to`: custom dates

**Response:**
- Header `Content-Type: text/csv; charset=utf-8`
- Header `Content-Disposition: attachment; filename="analytics-<report>-<date>.csv"`
- Automatic Spreadsheet Formula Injection Defense: Prepends single quote `'` to any value starting with `=`, `+`, `-`, `@`, `\t`, `\r`.
- Audit Log Recorded: `analytics_export.created`.

---

## 6. Frontend Dashboard UI

- **Location**: Mounted at `/app` with route alias redirect at `/app/dashboard`.
- **Navigation**: Integrated into `LeadNav` header bar with active indicator.
- **Widgets**:
  - `DateRangePicker`: Quick preset pills + custom date inputs + Refresh action.
  - `KpiCard`: 6 core executive cards with colored delta pills and icons.
  - `LeadTrendChart`: Responsive interactive SVG area and line chart with hover tooltips and dynamic time bucketing (`day`, `week`, `month`).
  - `StatusBreakdownCard`: Tenant status bars with stage colors, deal counts, and revenue.
  - `SourceBreakdownCard`: Acquisition channel rankings with conversion metrics.
  - `PipelineOverviewCard`: Revenue summary (Active, Avg Deal, Won, Lost) and funnel stages.
  - `TeamPerformanceTable`: Scoped agent leaderboard with search filter and CSV export.
  - `ActivityBreakdownCard`: Multichannel outreach metrics (Calls, WhatsApp, Emails, Meetings, Notes).
  - `FollowUpHealthCard`: Completion progress gauge, pending, and overdue metrics with link to `/app/follow-ups`.
  - Identity Context Details: Collapsible session & tenant verification card preserving Slice 2 auditability.

---

## 7. Verification Evidence

All 25 automated master test suites and live HTTP E2E checks passed:
1. `tests/analytics-unit.test.ts` — Date presets, comparison windows, delta math, Zod schemas.
2. `tests/analytics-integration.test.ts` — DB aggregations, trends, statuses, sources, pipeline, team stats, and CSV exports.
3. `tests/analytics-tenant-security.test.ts` — Cross-tenant isolation (Acme vs Zenith) and foreign IDOR defense.
4. `tests/analytics-spectator.test.ts` — Adversarial checks on Sales Rep (`OWN`) vs Manager (`TEAM`) vs Admin (`COMPANY`), soft-deletes, formula injection defense, and export audit logging.
5. `tests/http-e2e.test.ts` — Live HTTP API testing on `/api/v1/analytics/overview`, `/api/v1/analytics/export`, `/app`, and `/app/dashboard`.
6. Production Build — `npm run build` compiled all 31 routes cleanly in Next.js 16.
