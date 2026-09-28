# Getting Started with Universal CRM

Welcome to **Universal CRM**, a modern, multi-tenant customer relationship management platform designed for speed, clarity, and security.

---

## 1. Logging In

To access your CRM workspace:
1. Navigate to `/login` on your web browser.
2. Enter your work email address and password.
3. Click **Sign In**.

> [!NOTE]
> All user sessions are securely backed by the database. Sessions remain valid for 24 hours of inactivity or until you explicitly log out or change your password.

---

## 2. Navigating the Workspace

The top navigation bar provides instant access to every major section of your CRM:
- **Dashboard (`/app`)**: Real-time sales metrics, lead acquisition trends, conversion funnels, and team performance.
- **Leads (`/app/leads`)**: The operational nerve center for prospecting, filtering, and qualifying sales opportunities.
- **Follow-ups (`/app/follow-ups`)**: Your daily task queue showing overdue, today's, and upcoming follow-ups.
- **Settings (`/app/settings/...`)**: Configuration for users, teams, roles, company profile, custom fields, and security.
- **Help Center (`/app/help`)**: Contextual documentation and operating procedures.

---

## 3. Understanding Data Scopes & Visibility

Depending on your assigned role, the leads and records you can see are automatically scoped:
- **Sales Rep (OWN Scope)**: You see only leads, tasks, and activities assigned directly to you.
- **Manager (TEAM Scope)**: You see leads, tasks, and activities assigned to anyone on your managed team.
- **Admin (COMPANY Scope)**: You see all records across the entire company.

If you cannot find a specific lead, check with your company administrator to verify assignment or team membership.
