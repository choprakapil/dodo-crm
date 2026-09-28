# Feature Contract: Slice 7 — User & Team Management + Settings

## 1. Overview
Slice 7 implements the multi-tenant User Management, Team Organization, Role-Based Access Control (RBAC), Company Configuration, Security/Session Management, and immutable Audit Trail for Universal CRM. It enables organizations to scale from a single user up to tens of thousands of users across teams, roles, and fine-grained data scopes without sacrificing tenant isolation or performance.

---

## 2. Core Entities & Data Model

### 2.1 User
- Stored in `users` table, isolated by `companyId`.
- Attributes: `id`, `companyId`, `roleId`, `email`, `hashedPassword`, `name`, `phone`, `status` (`ACTIVE`, `INVITED`, `DISABLED`), `lastLoginAt`, `deletedAt`, `createdAt`, `updatedAt`.
- Relations:
  - Belongs to `Company` (`companyId`)
  - Belongs to `Role` (`roleId`)
  - Belongs to multiple `Teams` via `team_members` join table
  - Manages teams (`managedTeams: Team[]`)

### 2.2 Team & Team Members
- Stored in `teams` table, isolated by `companyId`.
- Attributes: `id`, `companyId`, `name`, `description`, `managerId`, `isActive`, `createdAt`, `updatedAt`.
- Roster: `team_members` junction table (`id`, `companyId`, `teamId`, `userId`, `createdAt`).
- Manager: Optional relation to `User` as designated operational manager. Assigning a manager auto-adds them to the team roster.

### 2.3 Roles & Permissions
- Stored in `roles` and `permissions` tables.
- System Roles:
  - `Admin` (Full system and tenant management)
  - `Manager` (Team-scoped leads, tasks, activities, reports)
  - `Sales Rep` (Own-scoped leads, tasks, activities, team visibility)
  - `Viewer` (Company-wide read-only access)
  - `Support` (Company-wide activity/note collaboration)
- Custom Roles: Tenants can create, modify, and delete custom roles with arbitrary action and data scope matrices (`OWN`, `TEAM`, `COMPANY`).
- Tamper Protection: System roles (`isSystem: true`) are immutable and undeletable.

### 2.4 User Invitations
- Stored in `invitations` table.
- Single-use 32-byte cryptographically secure random token (`crypto.randomBytes(32).toString("hex")`).
- Tokens are hashed using SHA-256 (`crypto.createHash("sha256").update(token).digest("hex")`) before storing in `invitations.tokenHash`.
- Raw token is only returned in the invite link / email and never persisted in plaintext.
- Validity: 7 days (`expiresAt`).
- Acceptance flow: Sets name and password, changes user status to `ACTIVE`, joins designated team, marks invitation `usedAt`, generates active DB session cookie (`universal_crm_session`).

### 2.5 Security & Sessions
- Multi-session management: Users can view active browser/device sessions (`userAgent`, `ipAddress`, `lastActiveAt`).
- Individual session revocation: Users can terminate individual devices.
- Bulk revocation: "Sign Out All Other Devices" revokes all active sessions except the current request.
- Self-password change: Requires verification of current password and minimum 8-character new password.

### 2.6 Company Settings & Standards
- Stored in `companies` table.
- Updatable fields: `name`, `email`, `phone`, `website`, `logoUrl`, `timezone`, `currency`, `dateFormat`.
- Tenant identifier `slug` is immutable after creation.

### 2.7 Audit Logs
- Stored in `audit_logs` table (`companyId`, `userId`, `action`, `entityType`, `entityId`, `metadata`, `ipAddress`, `createdAt`).
- Immutable and append-only: No delete or update API routes exist for audit logs.
- Strict tenant isolation: Filtered by `companyId === ctx.company.id`.

---

## 3. API Contract Matrix

| Method | Endpoint | Access / Permission | Description |
|---|---|---|---|
| `GET` | `/api/v1/users` | `users.manage` / `Admin` | List users with pagination and filters |
| `POST` | `/api/v1/users/invite` | `users.manage` / `Admin` | Create and send team invitation |
| `GET` | `/api/v1/users/:id` | `users.manage` / `Admin` | Get full user profile and team memberships |
| `PATCH` | `/api/v1/users/:id` | `users.manage` / `Admin` | Update user name, phone, role, teams |
| `DELETE` | `/api/v1/users/:id` | `users.manage` / `Admin` | Soft-delete user and revoke sessions |
| `POST` | `/api/v1/users/:id/status` | `users.manage` / `Admin` | Toggle user status (ACTIVE / DISABLED) |
| `POST` | `/api/v1/users/:id/reset-password` | `users.manage` / `Admin` | Admin password reset |
| `GET` | `/api/v1/invitations/:token` | Public | Inspect public invitation details |
| `POST` | `/api/v1/invitations/accept` | Public | Accept invite, set password, create session |
| `GET` | `/api/v1/teams` | Authenticated | List tenant teams and roster counts |
| `POST` | `/api/v1/teams` | `teams.manage` / `Admin` | Create team with optional manager |
| `GET` | `/api/v1/teams/:id` | Authenticated | Get team details, manager, and member roster |
| `PATCH` | `/api/v1/teams/:id` | `teams.manage` / `Admin` | Update team details or manager |
| `DELETE` | `/api/v1/teams/:id` | `teams.manage` / `Admin` | Delete team and unassign members |
| `POST` | `/api/v1/teams/:id/members` | `teams.manage` / `Admin` | Add user to team |
| `DELETE` | `/api/v1/teams/:id/members/:userId` | `teams.manage` / `Admin` | Remove user from team |
| `GET` | `/api/v1/roles` | Authenticated | List all system and custom roles |
| `POST` | `/api/v1/roles` | `roles.manage` / `Admin` | Create custom role with permissions |
| `GET` | `/api/v1/roles/:id` | Authenticated | Get role and permissions |
| `PATCH` | `/api/v1/roles/:id` | `roles.manage` / `Admin` | Update custom role permissions |
| `DELETE` | `/api/v1/roles/:id` | `roles.manage` / `Admin` | Delete custom role |
| `GET` | `/api/v1/permissions` | `roles.manage` / `Admin` | List system modules and available actions |
| `GET` | `/api/v1/company/settings` | `settings.manage` / `Admin` | Retrieve company profile and localization |
| `PATCH` | `/api/v1/company/settings` | `settings.manage` / `Admin` | Update company profile and localization |
| `GET` | `/api/v1/security/sessions` | Authenticated | List current user active sessions |
| `DELETE` | `/api/v1/security/sessions/:id` | Authenticated | Revoke specific session |
| `POST` | `/api/v1/security/sessions/revoke-all` | Authenticated | Revoke all other active sessions |
| `POST` | `/api/v1/security/change-password` | Authenticated | Change current user password |
| `GET` | `/api/v1/audit-logs` | `audit_logs.view` / `Admin` | Paginated immutable audit trail |

---

## 4. Security Verification
- **Privilege Escalation:** Non-admin role creators cannot grant permissions they do not possess.
- **System Role Immunity:** Deletion or alteration of system roles is blocked with `ValidationError`.
- **Last Admin Guard:** Administrators cannot deactivate themselves, preventing permanent lockout.
- **Instant Deactivation:** Disabling a user instantly deletes all active database sessions.
- **Cross-Tenant IDOR Defense:** All entity queries enforce `companyId: ctx.company.id`. Cross-tenant updates, reads, or entity injection attempts return `NotFoundError` or `ValidationError`.
- **Audit Logging:** Every user invite, activation, deactivation, password reset, team change, and role modification is permanently written to the immutable audit trail.
