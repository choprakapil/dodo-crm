# Multi-Tenant CRM SaaS — Product Requirements Document

**Document Version:** 1.0
**Product Type:** Multi-tenant SaaS CRM
**Target:** Fast V1 implementation with scalable architecture
**Initial Scale Target:** 20,000–30,000 registered users
**Architecture:** Modular Monolith
**Primary Database:** PostgreSQL
**Frontend:** Next.js + React + TypeScript
**ORM:** Prisma
**Styling:** Tailwind CSS + shadcn/ui

---

# 1. PRODUCT OVERVIEW

Build a modern, lightweight, multi-tenant CRM SaaS platform that allows different businesses to create their own CRM workspace and manage:

- Leads/enquiries
- Lead sources
- Lead statuses
- Lead assignments
- Employees/team members
- Roles
- Permissions
- Lead activity/history
- Follow-ups
- Basic reports
- Employee performance
- Company settings

The entire SaaS platform is controlled by a **Super Admin**.

Each customer/business is a completely isolated **Company/Tenant**.

The product must be designed so that the V1 can be built quickly, while the underlying architecture can support future modules such as:

- WhatsApp
- Calling
- SMS
- Email
- Automation
- AI
- Advanced analytics
- Integrations
- Billing
- Mobile applications

These future features should NOT be implemented in V1 unless specifically required.

---

# 2. PRIMARY PRODUCT GOAL

The goal is NOT to build a huge Salesforce-style CRM.

The goal is:

> Build a clean, fast, simple CRM that businesses can immediately use to manage enquiries and teams, while establishing a strong multi-tenant foundation that can later scale into a much larger CRM SaaS.

The first version should prioritize:

1. Correct architecture
2. Security
3. Multi-tenancy
4. Performance
5. Simple UX
6. Fast development
7. Maintainability
8. Easy future expansion

Avoid unnecessary complexity.

---

# 3. TARGET USERS

There are two major levels.

## 3.1 Platform Level

### Super Admin

The owner/operator of the CRM SaaS platform.

Super Admin manages:

- Companies
- Company accounts
- Company status
- Platform users
- Platform configuration
- Feature availability
- Plans/limits structure
- Platform audit logs

Super Admin is NOT a normal company user.

---

# 4. COMPANY LEVEL

Every business/customer gets its own isolated CRM workspace.

Example:

```text
CRM Platform
│
├── Company A
│   ├── Admin
│   ├── Managers
│   └── Employees
│
├── Company B
│   ├── Admin
│   ├── Managers
│   └── Employees
│
└── Company C
    ├── Admin
    ├── Managers
    └── Employees

```

Company A must never be able to access Company B's:

- Users
- Leads
- Activities
- Reports
- Settings
- Data
- Files
- API credentials

---

# 5. V1 MODULES

V1 should contain only these major modules:

```text
1. Authentication
2. Super Admin
3. Company Management
4. Dashboard
5. Leads
6. Lead Sources
7. Lead Statuses
8. Team / Users
9. Roles & Permissions
10. Activities / History
11. Tasks / Follow-ups
12. Basic Reports
13. Audit Logs
14. Company Settings

```

Do NOT build large additional modules in V1.

---

# 6. AUTHENTICATION

Implement:

- Login
- Logout
- Forgot password
- Reset password
- Change password
- Session management
- Profile
- Account status

Basic authentication flow:

```text
Email + Password
       ↓
Authentication
       ↓
Validate account
       ↓
Determine user type
       ↓
Determine company
       ↓
Load permissions
       ↓
Dashboard

```

There are two account categories:

```text
SUPER_ADMIN
COMPANY_USER

```

Never treat Super Admin as just another company role.

---

# 7. COMPANY / TENANT MODEL

Create a central `organizations` or `companies` entity.

Example:

```text
Company
---------
id
name
slug
logo
email
phone
website
timezone
currency
status
created_at
updated_at

```

Possible statuses:

```text
ACTIVE
SUSPENDED
TRIAL

```

Every company-owned record must reference the company.

Example:

```text
Lead
---------
id
company_id
name
phone
email
...

```

---

# 8. MULTI-TENANCY REQUIREMENT

This is one of the highest-priority requirements.

Every request made by a company user must be associated with exactly one company.

The backend must enforce tenant isolation.

Never rely only on frontend filtering.

Incorrect:

```text
GET /api/leads
→ return all leads
→ filter in frontend

```

Correct:

```text
Authenticated User
       ↓
Company ID
       ↓
Permission Check
       ↓
Company-scoped database query
       ↓
Return only authorized records

```

Every tenant-owned database query must be company-scoped.

Example:

```text
WHERE company_id = currentUser.companyId

```

Use centralized service/repository patterns so developers do not repeatedly implement tenant checks manually.

---

# 9. DATABASE

Use PostgreSQL.

Use Prisma as ORM.

Initial core tables:

```text
companies
users
roles
permissions
role_permissions
user_roles
teams
team_members

leads
lead_sources
lead_statuses
lead_status_history
lead_assignments

activities
notes
tasks

audit_logs

company_settings

```

Potential future tables:

```text
campaigns
integrations
webhooks
messages
calls
emails
automations
subscriptions
plans
feature_flags

```

Do not create unnecessary future tables unless required.

---

# 10. USER MODEL

Users belong to a company.

Example:

```text
users
------
id
company_id
name
email
phone
password_hash
avatar_url
status
last_login_at
created_at
updated_at

```

Status:

```text
ACTIVE
INVITED
DISABLED

```

Email should be unique within the appropriate account/tenant boundary.

Do not unnecessarily make the entire SaaS user namespace company-specific if a future global identity system may be needed.

---

# 11. INITIAL ROLES

V1 should include:

```text
Company Owner
Admin
Manager
Employee

```

These are default roles.

However, permissions must NOT be hardcoded directly into role checks.

Use:

```text
Role
 ↓
Permissions
 ↓
Data Scope

```

This allows future custom roles.

---

# 12. PERMISSION SYSTEM

Use granular permissions.

Examples:

```text
leads.view
leads.create
leads.edit
leads.delete
leads.assign
leads.reassign
leads.import
leads.export

users.view
users.create
users.edit
users.disable

roles.view
roles.create
roles.edit

reports.view
reports.export

tasks.view
tasks.create
tasks.edit
tasks.delete

settings.view
settings.edit

audit_logs.view

```

Do not create permissions for every tiny UI button.

Permissions should represent meaningful business actions.

---

# 13. DATA SCOPE

Permissions must support data scope.

Initial scopes:

```text
OWN
TEAM
COMPANY

```

Example:

```text
Employee
leads.view → OWN

Manager
leads.view → TEAM

Admin
leads.view → COMPANY

```

This means a user may have permission to view leads but still only see leads they are authorized to access.

---

# 14. TEAMS

V1 should support simple teams.

Example:

```text
Sales Team
Calling Team
Support Team
Marketing Team

```

Team model:

```text
teams
-----
id
company_id
name
description
manager_id
status
created_at
updated_at

```

A user may belong to a team.

Do not build complicated department hierarchy in V1.

---

# 15. LEAD MANAGEMENT

Leads are the core CRM entity.

Initial lead fields:

```text
id
company_id

first_name
last_name
full_name

phone
email

company_name

source_id
status_id

assigned_to
team_id

amount
priority

description

created_at
updated_at
created_by

```

Optional simple fields:

```text
city
state
country
website

```

Do not create hundreds of fields.

---

# 16. LEAD SOURCE MANAGEMENT

Sources must be configurable per company.

Default examples:

```text
Website
Facebook
Google
WhatsApp
Referral
Phone
Walk-in
Import
Other

```

Company Admin can:

- Create source
- Edit source
- Disable source
- Reorder source if needed

Source model:

```text
lead_sources
------------
id
company_id
name
description
status
created_at
updated_at

```

A disabled source should remain in historical records but should not normally be selectable for new leads.

---

# 17. LEAD STATUS MANAGEMENT

Default statuses:

```text
New
Contacted
Interested
Follow-up
Qualified
Converted
Lost

```

Company Admin can:

- Create status
- Edit status
- Disable status
- Change display order

Status model:

```text
lead_statuses
-------------
id
company_id
name
description
color_token
sort_order
is_default
status
created_at
updated_at

```

Do not hardcode the business workflow.

Different companies may use different statuses.

---

# 18. LEAD ASSIGNMENT

A lead can be assigned to:

- Employee
- Team

Initial workflow:

```text
Lead Created
     ↓
Assigned to Employee
     ↓
Employee works lead

```

Admin/Manager can:

- Assign
- Reassign
- Bulk assign if practical

Every assignment change must be recorded in history.

---

# 19. LEAD AMOUNT

Each lead may have:

```text
amount

```

Use an appropriate numeric/decimal database type.

Do not use floating point for financial values.

The company currency should be used for display.

Example:

```text
₹25,000
$500
€1,200

```

---

# 20. LEAD PRIORITY

Initial values:

```text
LOW
MEDIUM
HIGH
URGENT

```

Keep this simple.

---

# 21. LEAD DETAIL PAGE

The lead detail page should contain:

```text
------------------------------------------------
Lead Name
Status
Priority
Assigned User
Amount
------------------------------------------------

Contact Information

Phone
Email
Company
Location

------------------------------------------------

Lead Information

Source
Status
Assigned Team
Assigned Employee

------------------------------------------------

Actions

Change Status
Assign
Reassign
Add Note
Create Follow-up

------------------------------------------------

Activity Timeline

Created
Assigned
Called
Status Changed
Note Added
Follow-up Created
etc.
------------------------------------------------

```

---

# 22. LEAD ACTIVITY TIMELINE

Every meaningful lead action should be recorded.

Examples:

```text
Lead Created

Lead Assigned

Lead Reassigned

Status Changed

Priority Changed

Amount Changed

Note Added

Task Created

Task Completed

Task Cancelled

Lead Updated

```

Timeline example:

```text
10:02 AM
Lead created by Rahul

10:05 AM
Assigned to Amit

10:30 AM
Status changed:
New → Contacted

10:45 AM
Note added:
Customer requested callback.

11:30 AM
Follow-up created:
Tomorrow 11:00 AM

```

---

# 23. LEAD STATUS HISTORY

Maintain a dedicated status history table.

Example:

```text
lead_status_history
-------------------
id
company_id
lead_id

from_status_id
to_status_id

changed_by
changed_at

reason

```

Do not overwrite history.

If a lead goes:

```text
New
→ Contacted
→ Interested
→ Follow-up
→ Converted

```

all transitions should remain available.

---

# 24. ACTIVITY MODEL

Create a generic activity system.

Example:

```text
activities
----------
id
company_id
lead_id
user_id

type
title
description

metadata

created_at

```

Activity types:

```text
LEAD_CREATED
LEAD_UPDATED
LEAD_ASSIGNED
LEAD_REASSIGNED
STATUS_CHANGED
NOTE_ADDED
TASK_CREATED
TASK_COMPLETED

```

Design the activity system so future activities can be added without changing the architecture.

---

# 25. NOTES

Users with appropriate permissions can add notes to leads.

Example:

```text
Note:
Customer is interested in premium package.

Created by:
Rahul

Created at:
16 Sep 2026, 10:30 AM

```

Notes should be immutable or edit history should be recorded depending on implementation.

---

# 26. TASKS / FOLLOW-UPS

V1 should include simple follow-up tasks.

Task fields:

```text
id
company_id
lead_id
assigned_to
title
description
due_at
priority
status
created_by
created_at
completed_at

```

Task statuses:

```text
PENDING
COMPLETED
CANCELLED

```

Dashboard should show:

```text
Today's Follow-ups
Overdue
Upcoming
Completed

```

Do not build a complex project-management system.

---

# 27. DASHBOARD

Company dashboard should be simple and fast.

Display:

```text
Total Leads
New Leads
Contacted
Interested
Follow-ups
Converted
Lost
Total Lead Amount

```

Additional sections:

```text
Leads by Source
Leads by Status
Leads by Employee
Recent Activities
Today's Follow-ups

```

Filters:

```text
Today
Yesterday
Last 7 Days
This Month
Custom Range

```

Dashboard queries must be optimized.

Do not load every lead into the browser to calculate statistics.

Use server-side aggregate queries.

---

# 28. EMPLOYEE PERFORMANCE

V1 should provide factual activity metrics.

For each employee:

```text
Leads Assigned
Leads Created
Leads Updated
Status Changes
Follow-ups Created
Follow-ups Completed
Converted Leads
Lost Leads
Lead Amount

```

Example:

```text
Employee: Rahul

Assigned Leads: 250
Converted: 32
Lost: 18
Follow-ups: 145
Completed Follow-ups: 130
Lead Amount: ₹4,50,000

```

Do not create an opaque "employee score" in V1.

Show the underlying metrics.

---

# 29. PERFORMANCE REPORTS

Provide:

## Employee Report

Columns:

```text
Employee
Assigned
Created
Contacted
Qualified
Converted
Lost
Follow-ups
Amount

```

## Source Report

```text
Source
Total Leads
Converted
Lost
Conversion Percentage
Total Amount

```

## Status Report

```text
Status
Lead Count
Percentage

```

## Team Report

```text
Team
Members
Leads
Converted
Follow-ups
Amount

```

---

# 30. AUDIT LOG

Create a platform-wide audit mechanism for company actions.

Audit record:

```text
audit_logs
----------
id
company_id
user_id

action
module
entity_type
entity_id

description
metadata

ip_address
user_agent

created_at

```

Examples:

```text
Rahul created Lead #1025

Amit changed Lead #1025 status

Manager reassigned Lead #1025

Admin created user Neha

Admin changed Rahul's role

Admin disabled user Amit

```

Audit logs must be append-only from the application perspective.

Users should not be able to edit or delete audit history.

---

# 31. AUDIT LOG UI

Company Admin should be able to see:

```text
Who
What
Which module
Which record
When

```

Filters:

```text
User
Module
Action
Date range
Entity

```

Example:

```text
16 Sep 2026 10:30

Rahul Sharma
Changed Lead Status

Lead:
#1025

New → Contacted

```

---

# 32. SUPER ADMIN PANEL

Super Admin has a separate application area.

Example:

```text
/super-admin

```

Pages:

```text
Dashboard
Companies
Company Details
Platform Users
Audit Logs
Settings

```

---

# 33. SUPER ADMIN DASHBOARD

Display:

```text
Total Companies
Active Companies
Suspended Companies
Total Users
Active Users
Total Leads

```

Basic recent activity:

```text
New Company
New User
Company Suspended
Company Activated

```

Do not build advanced billing analytics in V1.

---

# 34. SUPER ADMIN COMPANY MANAGEMENT

Super Admin can:

- Create company
- View company
- Edit company
- Activate company
- Suspend company
- View basic statistics

Company detail:

```text
Company Name
Status
Created Date
Users
Teams
Leads
Recent Activity

```

---

# 35. COMPANY ADMIN

Company Admin can manage:

```text
Company
Users
Roles
Permissions
Teams
Lead Sources
Lead Statuses

```

They should NOT be able to:

- View another company
- Access Super Admin
- Modify platform configuration
- Access another tenant's audit logs/data

---

# 36. USER MANAGEMENT UI

Company Admin page:

```text
Team Members

Name
Email
Role
Team
Status
Last Login
Actions

```

Actions:

```text
View
Edit
Disable
Enable
Reset Password
Change Role

```

Add user:

```text
Name
Email
Phone
Role
Team
Status

```

---

# 37. ROLE MANAGEMENT UI

Display:

```text
Roles

Company Owner
Admin
Manager
Employee

```

Role details:

```text
Lead Permissions
[✓] View
[✓] Create
[✓] Edit
[ ] Delete
[✓] Assign

User Permissions
[✓] View
[ ] Create
[ ] Delete

Reports
[✓] View
[ ] Export

```

Support future custom roles without requiring a schema rewrite.

---

# 38. COMPANY SETTINGS

Initial settings:

```text
Company Name
Logo
Email
Phone
Website
Timezone
Currency

```

Do not build a giant settings system.

---

# 39. LEAD LIST

Lead list should support:

- Search
- Pagination
- Sorting
- Filtering
- Status filter
- Source filter
- Assigned user filter
- Team filter
- Priority filter
- Date filter

Example:

```text
Search leads...

Status ▼
Source ▼
Assigned User ▼
Team ▼
Priority ▼
Date ▼

```

Use server-side filtering.

Do NOT load thousands of leads into the browser.

---

# 40. PAGINATION

All large datasets must use pagination.

Minimum:

```text
20
50
100

```

records per page.

Use cursor pagination where appropriate for large/high-volume lists.

Do not implement "load all records" APIs.

---

# 41. SEARCH

V1 search should support:

```text
Lead Name
Phone
Email
Company

```

Search should be server-side.

Use appropriate database indexes.

---

# 42. DATABASE INDEXING

At minimum, evaluate indexes for:

```text
users.company_id
users.email

leads.company_id
leads.company_id + status_id
leads.company_id + source_id
leads.company_id + assigned_to
leads.company_id + team_id
leads.company_id + created_at

activities.company_id
activities.lead_id
activities.user_id

audit_logs.company_id
audit_logs.user_id
audit_logs.created_at

tasks.company_id
tasks.assigned_to
tasks.due_at

```

Use composite indexes based on actual query patterns.

Do not blindly index every column.

---

# 43. API ARCHITECTURE

Use versioned APIs where practical.

Example:

```text
/api/v1/auth
/api/v1/companies
/api/v1/users
/api/v1/roles
/api/v1/permissions
/api/v1/teams
/api/v1/leads
/api/v1/lead-sources
/api/v1/lead-statuses
/api/v1/activities
/api/v1/tasks
/api/v1/reports
/api/v1/audit-logs

```

Keep business logic out of route handlers.

Recommended:

```text
Route
 ↓
Validation
 ↓
Authorization
 ↓
Service
 ↓
Repository/Database

```

---

# 44. SERVICE ARCHITECTURE

Use a modular monolith.

Example:

```text
src/
│
├── app/
│
├── modules/
│   ├── auth/
│   ├── companies/
│   ├── users/
│   ├── roles/
│   ├── teams/
│   ├── leads/
│   ├── lead-sources/
│   ├── lead-statuses/
│   ├── activities/
│   ├── tasks/
│   ├── reports/
│   └── audit/
│
├── lib/
│   ├── auth/
│   ├── permissions/
│   ├── database/
│   ├── validation/
│   ├── logging/
│   └── security/
│
├── components/
│
└── types/

```

Each module should contain its own:

```text
service
validation
types
queries
business logic

```

Avoid one giant `utils.ts`, `services.ts`, or `api.ts`.

---

# 45. FRONTEND STRUCTURE

Use reusable components.

Example:

```text
components/
├── ui/
├── layout/
├── tables/
├── forms/
├── dialogs/
├── charts/
├── leads/
├── users/
└── dashboard/

```

Use consistent design tokens.

The interface should be:

- Clean
- Professional
- Fast
- Responsive
- Desktop-first
- Mobile usable

Do not create excessive animations.

---

# 46. UI DESIGN PRINCIPLES

The CRM should feel like a professional business application.

Prioritize:

```text
Information density
Fast navigation
Clear hierarchy
Readable tables
Consistent forms
Simple filters
Fast actions

```

Avoid:

- Excessive gradients
- Huge animations
- Decorative UI
- Unnecessary cards everywhere
- Slow visual effects
- Over-designed dashboards

---

# 47. RESPONSIVE DESIGN

Support:

### Desktop

Primary target.

### Tablet

Usable.

### Mobile

Basic usability.

Do not build a separate mobile application in V1.

---

# 48. NOTIFICATIONS

V1 can use simple in-app notifications.

Examples:

```text
New lead assigned
Follow-up due
Follow-up overdue
Lead reassigned

```

Do not build complex push notification infrastructure in V1.

---

# 49. IMPORT

Optional but recommended for V1:

CSV lead import.

Flow:

```text
Upload CSV
 ↓
Read headers
 ↓
Map columns
 ↓
Validate
 ↓
Preview
 ↓
Import

```

Import should happen in a controlled/background process if files become large.

Basic duplicate detection:

```text
Phone
Email

```

Do not build a sophisticated deduplication engine initially.

---

# 50. EXPORT

Allow authorized users to export leads.

Export must respect:

- Tenant
- User permissions
- Data scope

Never allow a user to export records they cannot normally view.

---

# 51. SECURITY REQUIREMENTS

Implement:

- Password hashing using a modern password hashing algorithm
- Secure sessions
- HTTP-only secure cookies where applicable
- CSRF protection where applicable
- Input validation
- Output validation
- Authorization on server
- Tenant isolation
- Rate limiting for authentication
- Rate limiting for sensitive APIs
- SQL injection protection through ORM/parameterized queries
- XSS-safe rendering
- Secure headers
- Audit logging
- Login activity tracking

Never trust:

```text
company_id
user_id
role
permissions

```

provided by the client.

Determine them from authenticated server-side context.

---

# 52. DATA ISOLATION

This requirement is mandatory.

A request such as:

```text
GET /api/v1/leads/123

```

must verify:

```text
Lead.company_id === currentUser.company_id

```

before returning it.

Same rule applies to:

- Leads
- Users
- Teams
- Sources
- Statuses
- Tasks
- Activities
- Reports
- Audit logs

Super Admin follows a separate authorization path.

---

# 53. PERFORMANCE TARGET

The application should be designed for:

```text
20,000–30,000 registered users

```

with potentially:

```text
Millions of leads

```

over time.

Do not assume all users are simultaneously active.

Initial performance goals:

- Normal page navigation: fast and responsive
- Standard database queries: generally sub-second under normal load
- Dashboard should use aggregate queries
- Lists must be paginated
- API responses should not contain unnecessary fields
- No N+1 database queries
- Avoid loading entire datasets into memory

---

# 54. SCALABILITY STRATEGY

Do NOT use microservices in V1.

Use:

```text
Modular Monolith
+
PostgreSQL

```

Initial architecture:

```text
             Internet
                 │
                 ▼
            Next.js App
                 │
                 ▼
            PostgreSQL

```

Later:

```text
                Load Balancer
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
       App #1       App #2      App #3
          │           │           │
          └───────────┼───────────┘
                      ↓
                 PostgreSQL
                      │
                    Redis

```

The codebase should make horizontal scaling possible later.

---

# 55. BACKGROUND JOBS

Do not introduce a queue unless needed.

But structure long-running operations so they can later move to background workers.

Examples:

```text
CSV imports
Large exports
Email
Notifications
Reports
Webhook processing

```

V1 can use simple processing for small operations.

---

# 56. CACHING

Do not add Redis everywhere.

Initially rely on:

- PostgreSQL indexes
- Efficient queries
- Next.js caching where appropriate

Introduce Redis later for:

- Rate limiting
- Cache
- Sessions if required
- Job queues
- High-frequency data

---

# 57. LOGGING

Application logs should include:

```text
timestamp
request ID
user ID
company ID
route
status
duration
error

```

Never log:

- Passwords
- Authentication secrets
- Tokens
- Sensitive personal data unnecessarily

---

# 58. ERROR HANDLING

Use standardized API responses.

Example:

```json
{
  "success": false,
  "error": {
    "code": "LEAD_NOT_FOUND",
    "message": "Lead not found"
  }
}

```

Do not expose database stack traces to users.

---

# 59. VALIDATION

Use a centralized schema validation library such as Zod.

Validate:

- Request body
- Query parameters
- Path parameters
- Imported data

Frontend validation is for UX.

Backend validation is mandatory.

---

# 60. EMPTY STATES

Every list should have a useful empty state.

Example:

```text
No leads found.

Create your first lead

```

Avoid blank screens.

---

# 61. LOADING STATES

Use:

- Skeletons
- Loading indicators
- Disabled submit states

Avoid blocking the entire application unnecessarily.

---

# 62. CONFIRMATION

Destructive actions should require confirmation.

Examples:

```text
Delete lead
Disable user
Delete role
Disable status

```

For critical actions, explain the effect.

---

# 63. SOFT DELETE

Use soft deletion where historical integrity matters.

Especially:

```text
Leads
Users
Sources
Statuses

```

Instead of physically deleting records that are referenced by history, prefer:

```text
deleted_at

```

or:

```text
status = DELETED

```

depending on entity.

Audit history should remain intact.

---

# 64. TIMEZONE

Store timestamps consistently, preferably in UTC.

Convert to company/user timezone for display.

Company should have:

```text
timezone

```

Do not store local time strings as the primary timestamp.

---

# 65. CURRENCY

Company should have:

```text
currency

```

Financial values should be stored in appropriate decimal/numeric types.

Never use JavaScript floating-point arithmetic for financial calculations.

---

# 66. ROUTE STRUCTURE

Suggested routes:

```text
/login
/forgot-password

/dashboard

/leads
/leads/new
/leads/[id]

/tasks

/team
/team/users
/team/roles
/team/teams

/settings
/settings/company
/settings/lead-sources
/settings/lead-statuses

/reports
/reports/leads
/reports/employees
/reports/sources

/audit-logs

```

Super Admin:

```text
/super-admin
/super-admin/companies
/super-admin/companies/[id]
/super-admin/users
/super-admin/audit-logs

```

---

# 67. LEAD CREATION FLOW

```text
User clicks Create Lead
        ↓
Form
        ↓
Validate
        ↓
Check permission
        ↓
Create lead
        ↓
Create LEAD_CREATED activity
        ↓
Optional assignment
        ↓
Create assignment activity
        ↓
Return lead

```

---

# 68. STATUS CHANGE FLOW

```text
User changes status
        ↓
Check permission
        ↓
Check lead scope
        ↓
Validate new status
        ↓
Update lead
        ↓
Create status history
        ↓
Create activity
        ↓
Return updated lead

```

All of these should occur transactionally where appropriate.

---

# 69. ASSIGNMENT FLOW

```text
Manager/Admin
       ↓
Select Lead
       ↓
Select User
       ↓
Authorization
       ↓
Update assignment
       ↓
Create assignment history
       ↓
Create activity

```

---

# 70. EMPLOYEE PERFORMANCE CALCULATION

Do not store every performance metric as manually editable data.

Calculate from source records where practical.

Example:

```text
Assigned Leads
= count of lead assignments

Converted Leads
= count of leads with converted status

Follow-ups Completed
= count of completed tasks

Lead Amount
= aggregate amount of applicable leads

```

This prevents reports becoming inconsistent with actual CRM data.

---

# 71. API LEAD CREATION — FUTURE-READY

Do not necessarily build a public developer portal in V1.

However, structure lead creation so a future endpoint can exist:

```text
POST /api/v1/leads

```

Potential future integrations:

```text
Website
Landing Page
Meta
Google
WhatsApp
External systems

```

The lead service should not care whether the lead came from:

```text
UI
API
Import
Webhook

```

Use a common lead creation service.

---

# 72. FUTURE MODULE ARCHITECTURE

The architecture must allow these to be added later:

```text
Calling
WhatsApp
SMS
Email
Campaigns
Automation
AI
Integrations
Webhooks
Billing
Mobile
Advanced Reporting

```

Example:

```text
modules/
├── leads/
├── users/
├── reports/
│
├── calling/       ← future
├── whatsapp/      ← future
├── automation/   ← future
├── ai/           ← future
└── billing/      ← future

```

Do not implement these now.

---

# 73. V1 NON-GOALS

Explicitly DO NOT build:

```text
❌ WhatsApp integration
❌ Calling integration
❌ SMS integration
❌ Email inbox
❌ AI lead scoring
❌ AI assistant
❌ Workflow builder
❌ Automation builder
❌ Advanced campaign management
❌ Mobile apps
❌ Complex billing
❌ SSO
❌ Enterprise identity federation
❌ Advanced BI
❌ Marketplace
❌ Plugin marketplace
❌ Microservices
❌ Kubernetes

```

The architecture should allow them later.

---

# 74. SEED DATA

Create development seed data.

Seed:

```text
1 Super Admin

2–3 Companies

Each company:
- Admin
- Manager
- Employees
- Teams
- Sources
- Statuses
- Leads
- Activities
- Tasks

```

This allows the entire application to be tested immediately.

---

# 75. DEMO COMPANY

Create a demo company in development.

Example:

```text
Demo Company

```

with:

```text
Admin
Manager
Employees
100+ leads
Multiple sources
Multiple statuses
Activities
Tasks

```

This should make it easy to visually test dashboards and reports.

---

# 76. TESTING REQUIREMENTS

Minimum automated testing:

### Unit tests

Test:

- Permission checks
- Tenant isolation
- Lead services
- Status changes
- Assignment
- Report calculations

### Integration tests

Test:

```text
Login
Create company
Create user
Create lead
Assign lead
Change status
Create task
Complete task
View report

```

### Security tests

Explicitly test:

```text
Company A user attempting to access Company B lead
Company A user attempting to access Company B user
Employee attempting admin endpoint
Employee attempting unauthorized lead
Suspended user attempting login
Disabled user attempting API access

```

These tests are extremely important.

---

# 77. ACCEPTANCE CRITERIA

The V1 is considered complete when:

## Authentication

- Users can log in.
- Users can log out.
- Password reset works.
- Disabled users cannot access the application.

## Multi-tenancy

- Companies are isolated.
- Company A cannot access Company B data.
- Backend enforces tenant isolation.
- Frontend cannot bypass authorization.

## Users

- Admin can create users.
- Admin can edit users.
- Admin can disable users.
- Admin can assign roles.
- Admin can assign teams.

## Permissions

- Permissions are checked server-side.
- Employee/Manager/Admin access differs correctly.
- Data scope works.

## Leads

- User can create lead.
- User can edit authorized leads.
- Admin can assign/reassign leads.
- Source can be selected.
- Status can be selected.
- Amount can be stored.
- Priority can be stored.

## History

- Status changes are recorded.
- Assignment changes are recorded.
- Important actions appear in activity timeline.
- Audit logs identify user and timestamp.

## Tasks

- Follow-ups can be created.
- Follow-ups can be completed.
- Overdue follow-ups are visible.

## Reports

- Dashboard statistics are accurate.
- Employee metrics are accurate.
- Source metrics are accurate.
- Date filters work.

## Super Admin

- Super Admin can create companies.
- Super Admin can activate/suspend companies.
- Super Admin can see company statistics.
- Super Admin cannot accidentally be treated as a normal tenant user.

---

# 78. PERFORMANCE ACCEPTANCE

The application should remain responsive with test data representing:

```text
30,000 users
1,000+ companies
1,000,000+ leads

```

The system should not require all data to be loaded into memory.

Test:

```text
Lead list
Lead search
Lead filtering
Dashboard
Reports
User list
Audit log

```

using realistic data volumes.

---

# 79. DEVELOPMENT PRINCIPLES

The AI development agent MUST follow these rules.

### Rule 1

Do not over-engineer.

### Rule 2

Do not create microservices.

### Rule 3

Do not duplicate business logic.

### Rule 4

Do not put business logic directly inside UI components.

### Rule 5

Do not trust client-supplied permissions or tenant IDs.

### Rule 6

Do not query tenant data without tenant scope.

### Rule 7

Do not load large datasets into the browser.

### Rule 8

Do not hardcode company-specific business rules.

### Rule 9

Do not hardcode roles directly into every feature.

### Rule 10

Do not build future modules before V1 is stable.

---

# 80. CODE QUALITY

The generated application must:

- Use TypeScript strictly
- Avoid unnecessary `any`
- Use reusable components
- Use typed API responses
- Validate API inputs
- Centralize authorization
- Centralize database access patterns
- Use transactions where required
- Use proper error handling
- Use meaningful names
- Avoid duplicated code
- Keep modules isolated
- Document non-obvious business logic

---

# 81. AI AGENT DEVELOPMENT RULE

Before implementing a feature, inspect the existing project structure.

Do not blindly create duplicate:

```text
components
services
utils
database
auth

```

If an existing architecture already exists, extend it.

Keep a clear internal architecture map.

After implementing each module:

```text
Build
↓
Lint
↓
Type check
↓
Unit tests
↓
Integration tests
↓
Fix errors
↓
Review

```

Do not consider a feature complete simply because the UI renders.

---

# 82. DATABASE MIGRATIONS

Every database change must use proper migrations.

Do not manually modify production database structures.

Migration history must remain reproducible.

Seed data should be separate from migrations.

---

# 83. ENVIRONMENT CONFIGURATION

Use environment variables for:

```text
DATABASE_URL
AUTH_SECRET
APP_URL

```

Future:

```text
REDIS_URL
SMTP_*
STORAGE_*
WHATSAPP_*

```

Never hardcode secrets.

Provide:

```text
.env.example

```

without real credentials.

---

# 84. DEPLOYMENT

Initial deployment should support a standard Linux server/VPS.

Recommended initial production structure:

```text
Internet
   ↓
Nginx
   ↓
Next.js
   ↓
PostgreSQL

```

Use:

```text
HTTPS
Process manager
Automatic restart
Database backups
Environment variables

```

Do not require Kubernetes for V1.

---

# 85. BACKUP

Production database must have automated backups.

Minimum strategy:

```text
Daily database backup

```

Prefer:

```text
Daily full backup
+
retention policy

```

Test restoration periodically.

A backup that has never been restored/tested should not be considered reliable.

---

# 86. OBSERVABILITY

At minimum:

```text
Application logs
Error logs
Database monitoring
Server CPU
Server RAM
Disk
Request errors
Response times

```

Future:

```text
Sentry
OpenTelemetry
Prometheus
Grafana

```

Do not make advanced observability a V1 blocker.

---

# 87. PRODUCT NAVIGATION

Company application:

```text
Dashboard

Leads
  ├── All Leads
  └── Create Lead

Tasks

Team
  ├── Users
  ├── Roles
  └── Teams

Reports
  ├── Leads
  ├── Employees
  └── Sources

Settings
  ├── Company
  ├── Lead Sources
  └── Lead Statuses

Audit Logs

```

Super Admin:

```text
Dashboard
Companies
Users
Audit Logs
Settings

```

---

# 88. V1 DEVELOPMENT ORDER

Build in this exact general order.

## Phase 1 — Foundation

```text
Project setup
Database
Prisma
Authentication
User model
Company model
Tenant context
Authorization foundation

```

## Phase 2 — RBAC

```text
Roles
Permissions
Data scopes
Teams
User management

```

## Phase 3 — CRM

```text
Leads
Sources
Statuses
Assignment
Lead details

```

## Phase 4 — Activity

```text
Activities
Status history
Notes
Audit logs

```

## Phase 5 — Tasks

```text
Follow-ups
Due dates
Overdue
Completion

```

## Phase 6 — Dashboard

```text
Statistics
Source report
Employee report
Status report

```

## Phase 7 — Super Admin

```text
Companies
Company status
Company statistics
Platform users

```

## Phase 8 — Hardening

```text
Security
Tenant isolation testing
Performance testing
Error handling
Indexes
Pagination
Logging
Backups
Production deployment

```

---

# 89. DEFINITION OF DONE

A module is NOT complete merely because its UI exists.

A module is complete only when:

```text
UI
+
API
+
Validation
+
Authorization
+
Database
+
Tenant isolation
+
Error handling
+
Loading states
+
Empty states
+
Tests
+
Audit/activity where applicable

```

are implemented.

---

# 90. FINAL PRODUCT SCOPE

The completed V1 should allow this complete workflow:

```text
SUPER ADMIN
     │
     │
     ▼
Create Company
     │
     ▼
Company Admin
     │
     ├── Configure Sources
     ├── Configure Statuses
     ├── Create Teams
     ├── Create Users
     ├── Assign Roles
     └── Configure Permissions
             │
             ▼
          Employee
             │
             ├── Create Lead
             ├── Receive Lead
             ├── Update Lead
             ├── Change Status
             ├── Add Note
             └── Create Follow-up
                     │
                     ▼
               Activity History
                     │
                     ▼
                  Reports
                     │
             ┌───────┴────────┐
             ▼                ▼
       Employee Report    Source Report

```

---

# 91. FUTURE EXPANSION ROADMAP

After V1 is stable, the platform can evolve toward:

## V1.1

```text
CSV import/export
Better notifications
Custom fields
Bulk actions

```

## V1.2

```text
API keys
Webhooks
Website lead forms

```

## V2

```text
WhatsApp
SMS
Calling
Email

```

## V3

```text
Automation
Campaigns
AI lead scoring
AI assistant
Advanced reporting

```

## V4

```text
Mobile application
Advanced integrations
Billing
Subscription plans
White labeling
Enterprise features

```

These are future features and must not unnecessarily complicate V1.

---

# 92. MOST IMPORTANT ARCHITECTURAL PRINCIPLE

The product must follow:

```text
SIMPLE V1
+
STRONG FOUNDATION
+
MODULAR CODE
+
STRICT TENANT ISOLATION
+
CENTRALIZED AUTHORIZATION
+
DATABASE INDEXING
+
PAGINATION
=
SCALABLE CRM

```

Do not confuse scalability with complexity.

The application should be able to start small and scale horizontally when actual traffic requires it.

---

# 93. ANTIGRAVITY EXECUTION INSTRUCTION

Build this product from this PRD as the source of truth.

Do not start by generating the entire application blindly.

First:

```text
1. Inspect repository
2. Create architecture plan
3. Create database schema
4. Review relationships
5. Implement authentication
6. Implement multi-tenancy
7. Implement RBAC
8. Implement CRM modules
9. Implement reporting
10. Implement Super Admin
11. Test
12. Optimize
13. Perform security review
14. Perform final UX review

```

Before writing substantial code, create these internal documents/files:

```text
/docs/
  architecture.md
  database.md
  permissions.md
  api.md
  development-plan.md

```

Keep them synchronized with the implementation.

Do not create unnecessary documentation for trivial code.

---

# 94. FINAL REQUIREMENT

The resulting product should feel like:

> **A lightweight, professional, fast CRM SaaS that any business can start using within minutes.**

It should NOT feel like:

> A giant enterprise CRM with hundreds of screens.

The first release should be focused on:

```text
Companies
Users
Roles
Permissions
Teams
Leads
Sources
Statuses
Assignments
Activities
Follow-ups
Reports
Audit Logs

```

Everything else should be designed as a future extension.

**Build V1 fast. Build the foundation correctly. Do not overbuild.**