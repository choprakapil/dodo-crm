# Audit Log Explorer & Compliance

The Audit Log Explorer (`/app/settings/audit-logs`) provides a tamper-proof, append-only history of every meaningful operation executed within your company.

---

## 1. What is Recorded?

Audit logs capture:
- **Authentication**: Successful logins, logouts, failed login attempts, password resets.
- **Lead Operations**: Creations, updates, reassignments, status transitions, deletions.
- **Tasks & Activities**: Task scheduling, task completions, activity logs.
- **Administration**: User invitations, status changes, role assignments, team alterations.
- **Settings**: Company configuration modifications, custom field definitions.
- **Data Transfers**: CSV import batches and lead export operations.

---

## 2. Filtering Audit Records

Use the filter controls to investigate specific events:
- **Action Filter**: Filter by action name (e.g. `auth.login`, `lead.deleted`, `user.status_updated`).
- **Entity Type**: Filter by target entity (e.g. `Lead`, `User`, `Team`, `Company`).
- **User Filter**: Isolate actions taken by a specific team member.
- **Date Range**: Set start and end boundaries.

---

## 3. JSON Metadata & Diff Inspector

Click the **View Details** button on any audit record to open the structured JSON modal inspector:
- **Actor Details**: Actor ID, IP address, and User-Agent.
- **State Diffs**: Previous values and new values for modified records.
- **Immutability Guarantee**: Audit logs are read-only and strictly tenant-isolated. No API or user interface exists to modify or delete audit log entries.
