# Feature Contract: Lead Import & Export (Slice 5)

**Status:** APPROVED & LOCKED  
**Module:** `leads`, `lead_imports`  
**Version:** 1.0  
**Target Scale:** 1,000+ companies / 1,000,000+ leads / bulk CSV ingest & export  

---

## 1. Actors & Data Scope Permissions
- **Tenant Admin:** `COMPANY` data scope across leads (`create`, `view`, `export`). Can import leads on behalf of the company and export company-wide leads with custom fields.
- **Manager:** `TEAM` data scope across leads. Can import leads for their team members and export leads within their team scope.
- **Sales Rep / Employee:** `OWN` data scope across leads. Can export only leads assigned to or created by them.
- **Role Permission Required for Export:** `leads.export` (or `leads.view`).
- **Role Permission Required for Import:** `leads.create`.

---

## 2. Preconditions & Tenant Isolation
- User must possess a valid, non-expired database-backed session cookie (`universal_crm_session`).
- User must belong to an `ACTIVE` company.
- Tenant context is strictly derived from the validated server-side `AuthContext`.
- Client-supplied `companyId`, `tenantId`, `userId`, `id`, `createdAt`, `updatedAt` in CSV files or requests are discarded.
- Foreign tenant references in CSV (e.g. referencing an email of a user or status ID belonging to another company) are rejected and defaulted to null / unassigned to guarantee strict tenant isolation.
- Lead import records (`lead_imports`) are strictly isolated per company (`companyId`). Foreign attempts to read or download error logs return HTTP 404 (`NotFoundError`).

---

## 3. CSV Import Architecture & Duplicate Handling

### A. Auto-Mapping Heuristics
The pure TypeScript RFC 4180 CSV engine parses uploaded CSV files and normalizes column headers to auto-suggest mappings to CRM fields:
- `name`: Matches "Name", "Lead Name", "Full Name", "Contact Name", "Client Name".
- `email`: Matches "Email", "Email Address", "E-Mail", "Work Email", "Mail".
- `phone`: Matches "Phone", "Phone Number", "Mobile", "Telephone", "Contact Number".
- `company`: Matches "Company", "Company Name", "Organization", "Business", "Account".
- `amount`: Matches "Amount", "Deal Value", "Budget", "Value".
- `priority`: Matches "Priority", "Urgency".
- `status`: Matches "Status", "Lead Status", "Stage".
- `source`: Matches "Source", "Lead Source", "Channel".
- `assignedUser`: Matches "Assigned User", "Assignee", "Owner", "Sales Rep".
- Custom fields: Matches active custom field keys or labels (prefixed with `cf_`).

### B. Duplicate Strategies
1. `SKIP`: If a lead with the same `email` (or `name` if no email) exists in the tenant, the CSV row is skipped and counted as `skippedRows`.
2. `UPDATE`: Existing matching leads are updated with the imported core fields and custom field values, counted as `updatedRows`. Protected fields (`id`, `createdAt`, `companyId`) are immutable.
3. `CREATE`: Always creates a new lead regardless of existing email/name.

### C. Chunked Batch Processing & Performance
- Imports are chunked in transactions of 100 rows per batch.
- Tenant reference data (statuses, sources, users, teams, and custom fields) are preloaded in-memory before chunk execution to eliminate N+1 database queries.
- Row-level errors (e.g. missing name, invalid date format) are captured with line number and reason into `errorSummary` without aborting the entire batch.
- Batch status progresses: `PROCESSING` -> `COMPLETED` | `COMPLETED_WITH_ERRORS` | `FAILED`.
- Error CSV with original row number and error description is downloadable directly from the UI.

---

## 4. CSV Export Architecture & Formula Injection Protection

### A. Data-Scope Awareness
- Export strictly queries `getLeadDataScopeWhere(ctx, "view")`.
- Sales Reps only export leads assigned to them (`OWN` scope).
- Managers only export leads within their team (`TEAM` scope).
- Admins export all company leads (`COMPANY` scope).
- Soft-deleted leads (`deletedAt !== null`) are strictly excluded.

### B. Dynamic Custom Fields Inclusion
- Active custom fields for the company are dynamically queried and appended as columns (`Deal Value`, `Property Type`, etc.) following core fields.
- Custom field values are formatted appropriately (e.g. joined arrays for multi-select, ISO strings for dates).

### C. Spreadsheet Formula Injection Neutralization
- Any cell value beginning with dangerous spreadsheet execution triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) is automatically sanitized by prepending a single quote (`'`).
- Prevents DDE formula execution and macro exploitation when exported CSVs are opened in Microsoft Excel, LibreOffice Calc, or Google Sheets.

---

## 5. Security & Tamper Resistance Guarantees
- **No Unprivileged Ingestion:** Unauthorized users cannot execute imports.
- **Tenant ID Spoofing Defense:** Adding a `companyId` column in CSV with a target tenant's ID has zero effect; all records are inserted with `ctx.company.id`.
- **Foreign Reference Rejection:** Referencing foreign tenant user emails or statuses falls back safely to null/default within the authenticated tenant.
- **Audit Logging:** Every CSV import execution and CSV export generation is recorded in `AuditLog` with counts and filter parameters.
