# Universal CRM — Troubleshooting & Diagnostics Guide

A practical troubleshooting and diagnostic manual for administrators, developers, and support teams resolving operational issues in Universal CRM.

---

## 1. Authentication & Login Issues

### Problem 1.1: User enters correct credentials but receives "Invalid email or password"
**Root Causes & Checks**:
1. **Case Sensitivity in Email**: While Universal CRM normalizes emails on creation (`toLowerCase()`), verify whether the user is typing the correct address.
2. **User in `INVITED` Status**: If the user was invited but has not completed the password creation flow at `/invite/[token]`, their `hashedPassword` is `null`. Direct login attempts will be rejected.
   - *Resolution*: Direct the user to complete their onboarding via the invitation link, or re-send the invite from `/app/settings/users`.
3. **Database Connection Interruption**: Check `/ready` endpoint (`curl http://localhost:3000/ready`). If the PostgreSQL pool is exhausted, requests will fail.

### Problem 1.2: User enters credentials but receives "Your account has been deactivated"
**Root Cause**: The user's status is set to `DISABLED` in PostgreSQL.
- *Resolution*: An administrator must open `/app/settings/users`, find the user, click the action menu (`...`), and select **Activate User**.

### Problem 1.3: User receives "Your organization account is currently suspended"
**Root Cause**: The company's `status` in the `companies` table is `SUSPENDED`.
- *Resolution*: This indicates an administrative or billing freeze applied by platform operators. All tenant users are blocked from `/app/*` until the company status is returned to `ACTIVE`.

---

## 2. Lead Visibility & Scoping Issues

### Problem 2.1: A Sales Rep cannot see a specific lead in their table
**Root Causes & Diagnostic Steps**:
1. **Check Assigned User**:
   - Universal CRM enforces `OWN` data scoping for the `Sales Rep` role.
   - Run query or inspect lead in admin view: Does `lead.assignedUserId === user.id`? If not, the rep cannot see the lead.
2. **Check Soft Deletion**:
   - Verify if `lead.deletedAt` is populated. Soft-deleted leads are excluded from tables and searches.
3. **Check Tenant Boundary**:
   - Ensure the lead belongs to the exact same `companyId` as the user. Leads from another company will never appear.

### Problem 2.2: A Manager cannot see leads belonging to their sales team
**Root Causes & Diagnostic Steps**:
1. **Check Team Membership in `team_members`**:
   - Universal CRM's `TEAM` scope checks the `team_members` junction table.
   - Ensure the sales reps owning the leads are enrolled in the manager's managed team.
2. **Check Role Scope**:
   - In `/app/settings/roles`, confirm that the manager's role has `leads:view` set to `TEAM` (or `COMPANY`) scope, not `OWN` scope.

---

## 3. Email Invitations & Onboarding

### Problem 3.1: Invitee clicks invitation link and sees "Invalid or expired invitation"
**Diagnostic Steps**:
1. **Check 7-Day Expiration**:
   - In PostgreSQL, check `invitations.expiresAt`. Tokens are valid for exactly 7 days.
2. **Check Single-Use Status**:
   - If `invitations.acceptedAt` is not null, the token was already redeemed.
   - *Resolution*: Have the company administrator send a new invitation from `/app/settings/users`.

### Problem 3.2: User did not receive the invitation email
**Diagnostic Steps**:
1. **Check SMTP Environment Variables**:
   - Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` in your `.env` file.
2. **Check Server Logs**:
   - If SMTP is unconfigured, Universal CRM's `EmailService` logs the invitation link directly to the application console (`[EmailService:Mock] Invitation email to user@domain.com: http://localhost:3000/invite/<token>`). Check application stdout to retrieve the link for testing.

---

## 4. Session Revocation & Access Control

### Problem 4.1: An administrator deactivated a user, but the user claims they can still see data
**Expected Behavior & Diagnostic Steps**:
1. When a user is deactivated:
   - `UserService.setUserStatus()` immediately executes `DELETE FROM sessions WHERE "userId" = :id`.
   - The user's browser may still be displaying cached DOM content if they do not interact with the page.
   - **Verification**: Have the user click any link or refresh the browser. The request is intercepted by `middleware.ts` and `validateSessionToken()`, which immediately terminates access and redirects to `/login`.

---

## 5. Analytics & Dashboard Metrics Discrepancies

### Problem 5.1: Two users see different numbers on the Dashboard for the same period
**Root Cause**:
- **Data Scoping is Active**:
  - The Sales Rep only sees metrics and conversion counts for **their own assigned leads**.
  - The Manager sees metrics for **their team members**.
  - The Admin sees metrics for the **entire organization**.
  - This is intentional by design to maintain departmental confidentiality.

### Problem 5.2: Deleted leads are not appearing in historical conversion counts
**Expected Behavior**:
- Universal CRM strictly excludes records where `deletedAt != null` from analytics and report exports. If a deal was deleted, its amount and count are removed from pipeline statistics to prevent skewing reports with invalid data.

---

## 6. Super Admin & Platform Console Operations

### Problem 6.1: Super Admin receives HTTP 401 or redirect loop when accessing `/admin/*`
**Root Causes & Diagnostic Steps**:
1. **Wrong Cookie / Session Separation**:
   - Super Admin operations do not use the tenant `universal_crm_session` cookie. They require `universal_crm_superadmin_session`.
   - Ensure you are logging in via `/admin/login`, not `/login`. Logging into the tenant portal does not grant platform admin rights.
2. **Super Admin Account Status**:
   - In PostgreSQL, verify `super_admins.isActive === true` and `deletedAt IS NULL`. If a super admin account was deactivated by another platform operator, all sessions are immediately rejected.
3. **Session Expiry**:
   - Super admin sessions expire after 24 hours of inactivity. Re-authenticate at `/admin/login`.

### Problem 6.2: Tenant user receives "Company is suspended" after platform operator action
**Expected Behavior & Diagnostic Steps**:
1. **Immediate Session Purge**:
   - When a Super Admin suspends a tenant (`POST /api/v1/admin/companies/:id/suspend`), Universal CRM executes an atomic transaction:
     - Sets `companies.status = 'SUSPENDED'`
     - Deletes all active sessions: `prisma.session.deleteMany({ where: { companyId } })`
     - Records an immutable `PlatformAuditLog` entry.
2. **Resolution**:
   - To restore access, the Super Admin must reactivate the tenant via `/admin/companies/:id` or `POST /api/v1/admin/companies/:id/reactivate`.
   - Once reactivated, tenant users can log in again. All historical data, users, and configurations remain intact.

### Problem 6.3: Tenant user receives `QUOTA_EXCEEDED` error when creating a user or lead
**Root Causes & Diagnostic Steps**:
1. **Plan Limits Reached**:
   - `QuotaService.assertCanCreateUser()` or `QuotaService.assertCanCreateLead()` checked the tenant's current counts against their assigned `Plan` limits:
     - `maxUsers`: Number of non-deleted users in the company.
     - `maxLeads`: Number of non-deleted leads in the company.
   - If count >= quota, the request is rejected with HTTP 402/400 `QUOTA_EXCEEDED`.
2. **Resolution**:
   - Open `/admin/companies/:id` in the Super Admin Console.
   - Upgrade the company's plan tier (e.g. from `FREE` or `STARTER` to `PROFESSIONAL` or `ENTERPRISE`), or edit the plan limits in `/admin/plans`.
   - The new quota takes effect immediately with zero downtime.

### Problem 6.4: Cross-Portal Access Prohibited
**Expected Behavior**:
- A Super Admin cannot use their super admin credentials on `/login` or `/api/v1/auth/login`.
- A Tenant User cannot use their tenant credentials on `/admin/login` or `/api/v1/admin/auth/login`.
- Attempting to pass a tenant session cookie to `/api/v1/admin/*` returns HTTP 401 (`SUPER_ADMIN_REQUIRED`).
- Attempting to pass a super admin session cookie to `/api/v1/*` (tenant routes) returns HTTP 401 (`UNAUTHORIZED`).

