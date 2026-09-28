# Universal CRM — Administrator Operations Guide

An exhaustive operational manual for Company Administrators, Operations Directors, and System Managers managing Universal CRM.

---

## Table of Contents
1. [User Administration & Lifecycle](#1-user-administration--lifecycle)
2. [Secure Email Invitations & Onboarding](#2-secure-email-invitations--onboarding)
3. [Departmental Teams & Member Rosters](#3-departmental-teams--member-rosters)
4. [Roles, Permissions & Data Scoping](#4-roles-permissions--data-scoping)
5. [Company Profile & Localization Settings](#5-company-profile--localization-settings)
6. [Security & Active Session Management](#6-security--active-session-management)
7. [Compliance & Audit Trail Inspection](#7-compliance--audit-trail-inspection)

---

## 1. User Administration & Lifecycle

Route: `/app/settings/users`

The User Management workspace allows administrators to provision accounts, assign security roles, structure departmental teams, and handle account deactivations.

### 1.1 Viewing & Filtering Users
- **Multi-Field Search**: Real-time filtering across user name, email address, and phone number.
- **Status Filter**: Filter by `ALL`, `ACTIVE`, `INVITED`, or `DISABLED`.
- **Role & Team Columns**: Displays assigned role pill and assigned team memberships.
- **Assigned Leads Metric**: Shows active opportunities currently assigned to each agent.

### 1.2 User Profile Inspection (`/app/settings/users/[id]`)
Clicking on any user opens their detailed profile card displaying:
- Account creation timestamp and last active login.
- Assigned permissions overview.
- Current team assignments and managed teams.

### 1.3 Disabling an Account & Immediate Session Invalidation
When an employee departs, an administrator can deactivate their access:
1. Click the action menu (`...`) on the user's row and choose **Deactivate User**.
2. Confirm the deactivation dialog.

#### What Happens Under the Hood:
- **Database Status**: The user's status is set to `DISABLED`.
- **Immediate Session Purge**: The server runs `DELETE FROM sessions WHERE "userId" = :userId`.
- **Instant Gate Enforcement**: On the user's very next HTTP request, middleware and `validateSessionToken()` reject the token. Even if the user has an active browser tab, their session cookie becomes invalid immediately, redirecting them to `/login` with an account disabled error.

### 1.4 Admin-Mediated Password Reset
If a user is locked out:
1. Click the action menu (`...`) and choose **Reset Password**.
2. Enter a temporary password complying with security rules (min 8 chars, uppercase, lowercase, number, symbol).
3. Confirm the reset.
4. The system encrypts the password with bcrypt (12 rounds) and immediately invalidates all active sessions for that user to prevent session hijacking.

### 1.5 Self-Lockout Protection
Universal CRM includes guardrails to prevent administrative lockout:
- An administrator cannot deactivate their own account.
- An administrator cannot remove their own `Admin` role.
- If an admin attempts self-deactivation, the API rejects the request with HTTP 400 (`ValidationError: You cannot deactivate your own account`).

---

## 2. Secure Email Invitations & Onboarding

### 2.1 Generating Invitations
1. On `/app/settings/users`, click **+ Invite User**.
2. Provide the user's full name and destination work email.
3. Select an initial role (System role or Custom role).
4. Optionally assign the user to a team.
5. Click **Send Invitation**.

### 2.2 Cryptographic Token Security
- Universal CRM generates a cryptographically secure 32-byte token (`crypto.randomBytes(32).toString("hex")`).
- The plain-text token is **never stored in the database**. Only a **SHA-256 hash** of the token is persisted in the `invitations` table (`tokenHash`).
- An email is dispatched via `EmailService` containing the acceptance link:
  `https://yourdomain.com/invite/{token}`
- The invitation is assigned a strict **7-day expiration** (`expiresAt = now + 7 days`).

### 2.3 User Acceptance & Activation Flow
1. The invitee clicks the link in their email, opening the public invitation acceptance page at `/invite/[token]` (or `/app/invite/[token]`).
2. The user establishes their account password.
3. Upon submission:
   - The token hash is looked up; expiration and single-use status (`acceptedAt == null`) are verified.
   - The user account is updated: `status = ACTIVE`, `hashedPassword = bcrypt(password, 12)`.
   - The user is automatically enrolled in their pre-assigned team via `team_members`.
   - The invitation is marked `acceptedAt = now()`.
   - A fresh DB session cookie is generated and issued, redirecting the user directly to `/app` without requiring a separate login step.

---

## 3. Departmental Teams & Member Rosters

Route: `/app/settings/teams`

Teams provide functional organizational structures (e.g. Enterprise Sales, West Coast, Inbound SDRs) and drive departmental data scoping.

### 3.1 Creating & Editing Teams
1. Click **+ Create Team** on `/app/settings/teams`.
2. Enter team name and optional description.
3. Designate an active user as **Team Manager**.
4. Click **Create Team**.

> [!NOTE]
> When a manager is designated, Universal CRM automatically inserts a record into the `team_members` junction table to ensure the manager is a registered member of their own team roster.

### 3.2 Managing the Member Roster (`/app/settings/teams/[id]`)
- **Adding Members**: Click **+ Add Member**, select an active user, and confirm. Duplicate memberships within the same team are prevented.
- **Removing Members**: Click **Remove** beside any member row. The user is detached from the team without deleting their account or modifying their assigned leads.
- **Manager Badge**: The designated manager is highlighted with a gold crown and shield indicator.

### 3.3 Team Archiving
When a team is retired:
- Click **Delete / Archive Team**.
- The team's `isActive` flag is updated to `false`.
- Historical lead assignments, activities, and audit logs are preserved intact.

---

## 4. Roles, Permissions & Data Scoping

Route: `/app/settings/roles`

Universal CRM implements a centralized authorization engine based on granular module-action permissions with multi-tenant data scopes.

### 4.1 The 5 Seeded System Roles
| Role Name | Default Data Scope | Description |
|---|:---:|---|
| **Admin** | `COMPANY` | Unrestricted administrative control across all modules, settings, users, and audit logs. |
| **Manager** | `TEAM` | Departmental lead access: manages team leads, team tasks, and reviews team analytics. |
| **Sales Rep** | `OWN` | Frontline salesperson: creates and manages assigned leads and individual follow-ups. |
| **Viewer** | `COMPANY` (Read-only) | Read-only inspection of company leads and reports without editing or deletion capabilities. |
| **Support** | `COMPANY` | Operational support: logs calls, emails, notes, and assists in customer communication. |

*System roles have `isSystem: true` and cannot be deleted or renamed.*

### 4.2 The 3 Data Scopes Explained
Every permission is bound to a `DataScope`:
1. **`OWN`**:
   - The user can only view/mutate records where `assignedUserId === currentUser.id`.
   - *Example*: A Sales Rep only sees their own assigned leads.
2. **`TEAM`**:
   - The user can view/mutate records assigned to themselves OR assigned to any user who shares a team membership in `team_members`.
   - *Example*: A Manager sees leads owned by anyone on their sales team.
3. **`COMPANY`**:
   - Unrestricted visibility across the entire tenant organization (`companyId === currentCompany.id`).
   - *Example*: An executive or admin viewing organization-wide pipeline reports.

### 4.3 Custom Role Builder
Administrators can create bespoke roles tailored to specific operational needs:
1. Click **+ Create Custom Role**.
2. Specify a Role Name (e.g. "Lead Qualifier", "Billing Specialist").
3. Toggle permissions across the 9 core modules:
   - `customers`: `view`, `create`, `update`, `delete`, `manage`
   - `leads`: `view`, `create`, `update`, `delete`, `assign`
   - `activities`: `view`, `create`, `update`, `delete`
   - `tasks`: `view`, `create`, `update`, `delete`
   - `analytics`: `view`, `export`
   - `users`: `view`, `create`, `update`, `manage`
   - `teams`: `view`, `create`, `update`, `manage`, `delete`
   - `settings`: `view`, `manage`
   - `audit_logs`: `view`
4. Set the applicable Data Scope (`OWN`, `TEAM`, `COMPANY`) for each permission.
5. Click **Save Role**.

### 4.4 Privilege Escalation Prevention
- Only users with administrative privileges (`settings:manage`) can create, modify, or assign custom roles.
- Non-administrators cannot grant permissions exceeding their own security boundaries.

---

## 5. Company Profile & Localization Settings

Route: `/app/settings/company`

Configure tenant branding, contact information, and business localization rules:
- **Company Name & Slug**: Legal organization name and tenant URL slug.
- **Branding**: HTTPS Logo URL rendered in application headers and email templates.
- **Support Coordinates**: Support email and phone displayed on invitation emails.
- **Operating Timezone**: Standardized company timezone (e.g. `UTC`, `America/New_York`, `Europe/London`). All backend dates are stored in UTC and converted to this timezone for display.
- **Currency**: Primary currency code (`USD`, `EUR`, `GBP`, `INR`, etc.) applied to opportunity deal amounts and pipeline totals.
- **Date Format**: Standardized display format (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`).

---

## 6. Security & Active Session Management

Route: `/app/settings/security`

Universal CRM enables real-time device auditing and centralized session control:
- **Active Session Table**: Displays device/browser User-Agent, origin IP address, creation date, and last active timestamp.
- **Current Device Flag**: Clearly indicates which session belongs to the current browser.
- **Individual Session Revocation**: Click **Revoke** on any row to invalidate that specific device's session in PostgreSQL.
- **Sign Out All Other Devices**: One-click bulk invalidation that deletes all session tokens for your account except the one currently in use.

---

## 7. Compliance & Audit Trail Inspection

Route: `/app/settings/audit-logs`

Universal CRM maintains an append-only, tamper-proof audit trail of every meaningful system operation.

### 7.1 What Events are Logged?
- **Authentication**: `auth.login`, `auth.logout`, `auth.password_reset`.
- **Leads**: `lead.created`, `lead.updated`, `lead.deleted`, `lead.status_changed`, `lead.reassigned`.
- **Tasks & Activities**: `task.created`, `task.completed`, `activity.logged`.
- **Administration**: `user.invited`, `user.status_updated`, `role.created`, `team.created`.
- **Settings**: `company_settings.updated`, `custom_field.created`.

### 7.2 Filtering & Investigation
- **Action Filter**: Target specific events (e.g. `user.status_updated`).
- **Entity Type**: Filter by `User`, `Lead`, `Team`, or `Company`.
- **Actor Filter**: Isolate actions initiated by a specific administrator or user.
- **Date Boundary**: Set calendar start and end ranges.

### 7.3 JSON Metadata & State Diff Inspector
Click **View Details** on any log row to inspect the structured metadata modal:
- **Actor Context**: User ID, origin IP address, and browser User-Agent.
- **State Diffs**: Previous values and new values for changed attributes.
- **Immutability Guarantee**: Audit logs are read-only and strictly tenant-isolated. No API or UI endpoint allows editing or deleting audit log entries.

---

## 8. Customer Identity & Relationship Governance

### 8.1 Customer Identity Invariants
- **ONE CUSTOMER ≠ ONE ENQUIRY**: The Customer model serves as the master entity across years. Multiple commercial transactions (Leads/Enquiries) link to one Customer.
- Modifying, reassigning, or deleting a Customer never modifies or deletes underlying enquiry opportunities.

### 8.2 Phone & Contact Normalization
- All customer phone numbers are strictly parsed and normalized to standard E.164 format (`+1...`, `+91...`) utilizing tenant default country configuration.
- The system enforces a unique composite constraint `@@unique([companyId, normalizedPhone])` to prevent duplicate customer profiles within the same tenant.
- Duplicate phone registration attempts return HTTP 409 Conflict.

### 8.3 Contact Management Rules
- Primary phone and email rules prevent accidental null states: when removing a primary contact channel, the system automatically promotes the oldest remaining contact point to primary.
- Contact points cannot be stolen or transferred between customers without explicit administrative authorization.

### 8.4 Customer Soft Deletion
- `DELETE /api/v1/customers/:id` marks `deletedAt = now()`.
- Customer deletion **preserves** all linked historical enquiries, activities, tasks, notes, and custom field values. Soft-deleted customers are excluded from active search but their business records remain verifiable for financial audits.
