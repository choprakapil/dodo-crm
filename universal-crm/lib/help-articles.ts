export interface HelpArticle {
  slug: string;
  title: string;
  category: string;
  categoryTitle: string;
  summary: string;
  requiredRole?: "ADMIN" | "MANAGER" | "USER";
  requiredPermission?: { module: string; action: string };
  tags: string[];
  content: string;
}

export const HELP_CATEGORIES = [
  { id: "getting-started", title: "Getting Started", description: "Learn the basics of Universal CRM", adminOnly: false },
  { id: "leads", title: "Lead Management", description: "Capturing, organizing, and qualifying leads", adminOnly: false },
  { id: "activities", title: "Activities & Timeline", description: "Logging calls, WhatsApp, emails, notes, and meetings", adminOnly: false },
  { id: "follow-ups", title: "Follow-up Tasks", description: "Managing reminders, due dates, and task completion", adminOnly: false },
  { id: "analytics", title: "Reports & Analytics", description: "Interpreting KPIs, pipeline funnels, and performance metrics", adminOnly: false },
  { id: "import-export", title: "Import & Export", description: "Bulk CSV imports, auto-mapping, and data exports", adminOnly: false },
  { id: "custom-fields", title: "Custom Fields", description: "Configuring dynamic company-specific attributes", adminOnly: true },
  { id: "users", title: "Users & Invitations", description: "Inviting team members, managing accounts, and resetting passwords", adminOnly: true },
  { id: "teams", title: "Team Management", description: "Structuring departments, managers, and member rosters", adminOnly: true },
  { id: "roles-permissions", title: "Roles & Permissions", description: "System roles, custom roles, and data scope rules", adminOnly: true },
  { id: "company-settings", title: "Company Settings", description: "Branding, localization, currency, and date formats", adminOnly: true },
  { id: "security", title: "Security & Sessions", description: "Password management, active sessions, and multi-device revocation", adminOnly: false },
  { id: "audit-logs", title: "Audit Trail", description: "Inspecting tamper-proof operational audit logs", adminOnly: true },
  { id: "faq", title: "Frequently Asked Questions", description: "Answers to common operational questions", adminOnly: false },
] as const;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting Started with Universal CRM",
    category: "getting-started",
    categoryTitle: "Getting Started",
    summary: "An introduction to logging in, navigating the CRM, and understanding your workspace.",
    tags: ["login", "navigation", "dashboard", "overview"],
    content: `
# Getting Started with Universal CRM

Welcome to **Universal CRM**, a modern, multi-tenant customer relationship management platform designed for speed, clarity, and security.

---

## 1. Logging In

To access your CRM workspace:
1. Navigate to \`/login\` on your web browser.
2. Enter your work email address and password.
3. Click **Sign In**.

> [!NOTE]
> All user sessions are securely backed by the database. Sessions remain valid for 24 hours of inactivity or until you explicitly log out or change your password.

---

## 2. Navigating the Workspace

The top navigation bar provides instant access to every major section of your CRM:
- **Dashboard (\`/app\`)**: Real-time sales metrics, lead acquisition trends, conversion funnels, and team performance.
- **Leads (\`/app/leads\`)**: The operational nerve center for prospecting, filtering, and qualifying sales opportunities.
- **Follow-ups (\`/app/follow-ups\`)**: Your daily task queue showing overdue, today's, and upcoming follow-ups.
- **Settings (\`/app/settings/...\`)**: Configuration for users, teams, roles, company profile, custom fields, and security.
- **Help Center (\`/app/help\`)**: Contextual documentation and operating procedures.

---

## 3. Understanding Data Scopes & Visibility

Depending on your assigned role, the leads and records you can see are automatically scoped:
- **Sales Rep (OWN Scope)**: You see only leads, tasks, and activities assigned directly to you.
- **Manager (TEAM Scope)**: You see leads, tasks, and activities assigned to anyone on your managed team.
- **Admin (COMPANY Scope)**: You see all records across the entire company.

If you cannot find a specific lead, check with your company administrator to verify assignment or team membership.
    `,
  },
  {
    slug: "dashboard",
    title: "Reports & Analytics Dashboard",
    category: "analytics",
    categoryTitle: "Reports & Analytics",
    summary: "How to interpret KPI summary cards, time-series charts, pipeline funnels, and leaderboard metrics.",
    tags: ["dashboard", "metrics", "kpi", "pipeline", "leaderboard"],
    content: `
# Reports & Analytics Dashboard

The Executive Dashboard at \`/app\` provides a real-time, aggregated overview of your sales performance and operational health.

---

## 1. KPI Summary Cards

The top of the dashboard displays 6 primary sales performance indicators:
1. **Total Leads**: The total volume of active (non-deleted) leads within your data scope.
2. **New Leads**: Leads created within the currently selected date range, along with a zero-safe comparison delta against the preceding period.
3. **Converted Leads**: Leads that have reached a \`CONVERTED\` or \`WON\` status within the window.
4. **Conversion Rate**: Percentage of leads converted (\`Converted / Total * 100\`).
5. **Pipeline Value**: Aggregate monetary value of active opportunities in the pipeline.
6. **Follow-ups Due**: Pending follow-up tasks due today or overdue requiring urgent attention.

---

## 2. Date Range Filter

Use the date range selector at the top-right to adjust metrics:
- **Preset Options**: \`Today\`, \`7 Days\`, \`30 Days\`, \`This Month\`, \`Quarter\`, \`Year\`.
- **Custom Range**: Specify an exact start and end date (up to a maximum of 730 days).

---

## 3. Lead Creation Trend Chart

The interactive SVG area chart visualizes lead acquisition velocity:
- **Dynamic Bucketing**: Automatically groups data points by **Day** (periods <= 31 days), **Week** (<= 90 days), or **Month** (> 90 days).
- **Hover Tooltips**: Hover over data nodes to see the exact date and volume of leads captured.
- **Continuous Zero-Baseline**: Dates with zero lead creation are displayed with explicit 0 values for an honest, undistorted trendline.

---

## 4. Status & Source Breakdowns

- **Status Distribution**: Progress bars showing lead distribution across stages (e.g., New, Contacted, Qualified, Negotiation, Won, Lost).
- **Source Breakdown**: Acquisition channels (e.g., Website, Referrals, Google Ads, LinkedIn) with total lead counts and deal amounts.

---

## 5. Team Performance Leaderboard

Admins and Managers can inspect agent productivity:
- Displays Assigned Leads, Won Deals, Pipeline Amount, Completed Activities, and Conversion Rates.
- Uses server-side batched aggregations to ensure instant loading even with large historical databases.
- Click **Export CSV** to download a spreadsheet report with formula-injection defenses applied.
    `,
  },
  {
    slug: "leads",
    title: "Lead Management & Opportunity Tracking",
    category: "leads",
    categoryTitle: "Lead Management",
    summary: "Capturing leads, updating deal values, advancing statuses, and conducting multi-field searches.",
    tags: ["leads", "opportunities", "search", "filters", "status"],
    content: `
# Lead Management & Opportunity Tracking

The Leads workspace (\`/app/leads\`) is the core operational table where sales opportunities are captured, assigned, and moved through your sales cycle.

---

## 1. Creating a Lead

1. From the Leads table, click the **+ New Lead** button.
2. Complete the lead information form:
   - **Lead Name** (required): Contact or business lead name.
   - **Company**: Organization or business name.
   - **Email & Phone**: Primary communication coordinates.
   - **Deal Value**: Expected monetary opportunity value in your company's currency.
   - **Status**: Starting status (defaults to your company's default initial status).
   - **Source**: Where the lead originated (Website, Referral, Event, etc.).
   - **Priority**: Low, Medium, High, or Urgent.
   - **Assignee**: Sales agent responsible for working the lead.
   - **Custom Fields**: Any dynamic attributes configured by your administrator.
3. Click **Create Lead**.

> [!NOTE]
> Creating a lead automatically writes a \`LEAD_CREATED\` entry into the lead's activity timeline and generates an immutable audit log.

---

## 2. Searching & Filtering Leads

The filter bar allows high-speed filtering across large volumes:
- **Live Search**: Type into the search input to instantly filter across **Lead Name**, **Company**, **Email**, and **Phone**.
- **Status Filter**: Filter by one or multiple sales pipeline statuses.
- **Source Filter**: Filter by lead acquisition channel.
- **Priority Filter**: Focus on \`HIGH\` or \`URGENT\` priority deals.

---

## 3. Lead Detail View (\`/app/leads/[id]\`)

Clicking on any lead row opens the comprehensive Lead Detail page:
- **Opportunity Summary Banner**: Quick status selector and one-click assignee dropdown.
- **Overview Card**: Phone, email, company, deal value, source, and priority.
- **Custom Fields Card**: Formatted display of dynamic business fields.
- **Activity & History Timeline**: Complete chronological record of every call, meeting, status change, and reassignment.

---

## 4. Soft Deletion

When a lead is deleted:
- It is not permanently wiped from the database. Instead, a \`deletedAt\` timestamp is applied.
- The lead is excluded from standard lists, searches, and analytics counts.
- Historical audit logs and activities remain intact for compliance.
    `,
  },
  {
    slug: "activities",
    title: "Activities & Lead Timeline",
    category: "activities",
    categoryTitle: "Activities & Timeline",
    summary: "Logging calls, WhatsApp messages, emails, notes, and meetings directly on the lead timeline.",
    tags: ["activities", "timeline", "calls", "notes", "meetings", "whatsapp"],
    content: `
# Activities & Lead Timeline

The Universal CRM timeline gives you a 360-degree chronological audit of every customer touchpoint and automated system event.

---

## 1. Supported Activity Types

You can record 5 primary types of customer interactions:
1. **Call**: Phone conversations with duration, outcome, and notes.
2. **WhatsApp**: Chat transcripts or messaging touchpoints.
3. **Email**: Correspondence summaries or sent proposals.
4. **Meeting**: In-person or virtual video conference summaries.
5. **Note**: Internal notes, observations, or strategy thoughts.

---

## 2. How to Log an Activity

1. Open any lead detail page at \`/app/leads/[id]\`.
2. Click the **+ Log Activity** button in the header or timeline header.
3. Select the **Activity Type** (Call, WhatsApp, Email, Meeting, or Note).
4. Enter a **Subject** (e.g. "Introductory demo call").
5. Provide a detailed **Description** of the discussion.
6. Click **Save Activity**.

The interaction appears immediately at the top of the lead timeline with its dedicated colored badge and icon.

---

## 3. Timeline Filter Tabs

The timeline features 4 focused views:
- **All Timeline**: Every customer interaction, status transition, task completion, and assignment.
- **Interactions Only**: Only customer touchpoints (Calls, WhatsApp, Emails, Meetings, Notes).
- **Status History**: Visual record of when the lead moved between pipeline stages, including actor and duration in stage.
- **Assignment History**: Detailed log of who owned the lead and when it was reassigned.
    `,
  },
  {
    slug: "follow-ups",
    title: "Follow-up Tasks & Reminders",
    category: "follow-ups",
    categoryTitle: "Follow-up Tasks",
    summary: "Scheduling tasks, tracking overdue reminders, and completing follow-ups with instant sync.",
    tags: ["tasks", "follow-ups", "due-date", "reminders", "completion"],
    content: `
# Follow-up Tasks & Reminders

Never lose track of a prospect. The Follow-up workspace (\`/app/follow-ups\`) organizes all scheduled sales touchpoints by urgency and due date.

---

## 1. Scheduling a Follow-up

You can schedule a follow-up directly from any lead detail view:
1. Open the lead at \`/app/leads/[id]\`.
2. Click **+ Schedule Follow-up**.
3. Enter:
   - **Task Title** (e.g. "Send revised pricing proposal").
   - **Due Date & Time**: When the task must be completed.
   - **Priority**: \`LOW\`, \`MEDIUM\`, \`HIGH\`, or \`URGENT\`.
   - **Assignee**: Who is responsible (defaults to lead owner).
   - **Description**: Detailed preparation notes.
4. Click **Create Follow-up**.

A \`TASK_CREATED\` entry is automatically posted to the lead's timeline.

---

## 2. Follow-up Workspace (\`/app/follow-ups\`)

Navigate to \`/app/follow-ups\` in the top navigation to view your organized task queue:
- **Today**: Tasks scheduled for today.
- **Overdue**: Critical tasks whose due date has passed without completion.
- **Upcoming**: Scheduled future tasks.
- **All Follow-ups**: Unfiltered view across all statuses.
- **Completed**: Historical log of completed follow-ups.
- **Cancelled**: Abandoned tasks with reasons.

---

## 3. One-Click Completion

When you finish a task:
1. Locate the task in the Follow-ups table or on the lead detail view.
2. Click the green **Complete** button.
3. The task immediately transitions to \`COMPLETED\`, stamping your user ID and timestamp.
4. A \`TASK_COMPLETED\` event is posted to the associated lead's timeline, keeping the whole team informed.
    `,
  },
  {
    slug: "import-export",
    title: "Lead Import & Export Operations",
    category: "import-export",
    categoryTitle: "Import & Export",
    summary: "Step-by-step guide to CSV lead importing, auto-mapping, duplicate policies, and secure data exports.",
    tags: ["csv", "import", "export", "mapping", "duplicates"],
    content: `
# Lead Import & Export Operations

Universal CRM includes a high-performance, streaming RFC 4180 CSV engine built from the ground up for reliable bulk data migration.

---

## 1. Importing Leads from CSV

To access the import wizard:
1. Navigate to \`/app/leads\` and click **Import Leads** (or visit \`/app/leads/import\`).
2. **Step 1 — Upload**:
   - Drag and drop your \`.csv\` file.
   - The file is read client-side and sent to the server preview endpoint.
3. **Step 2 — Column Mapping**:
   - The system automatically matches CSV headers against lead fields (Name, Email, Phone, Company, Deal Value, Status, Source, Priority) and company **Custom Fields**.
   - Review the suggested mappings and adjust any unmapped columns.
4. **Step 3 — Duplicate Strategy**:
   - **SKIP**: If a lead with matching email or phone exists, ignore the CSV row.
   - **UPDATE**: Update existing lead attributes with the CSV row values.
   - **CREATE**: Always create a new lead record regardless of matches.
5. **Step 4 — Execute**:
   - Click **Start Import**. The server processes rows in atomic 100-row transaction chunks with in-memory reference caching.
   - Upon completion, view total rows processed, created, updated, and skipped.
   - If any rows failed validation, download the **Error Summary CSV** to inspect and correct the invalid lines.

---

## 2. Exporting Leads to CSV

To export your CRM data:
1. Navigate to \`/app/leads\`.
2. Apply any desired filters (e.g. status, priority, or search term).
3. Click **Export CSV** in the top-right toolbar.
4. The server generates a clean, RFC 4180 compliant CSV containing:
   - All standard lead columns.
   - Active dynamic custom fields.
   - Strictly scoped to your permissions (Sales Reps export only their leads; Admins export company leads).

### Spreadsheet Formula Injection Protection
Exported files automatically neutralize malicious spreadsheet formulas:
- Any cell value starting with dangerous formula triggers (\`=\`, \`+\`, \`-\`, \`@\`, \`\\t\`, \`\\r\`) is automatically prefixed with a single quote (\`'\`).
- This prevents formula execution attacks when opening exported data in Microsoft Excel or Google Sheets.
    `,
  },
  {
    slug: "custom-fields",
    title: "Configuring Dynamic Custom Fields",
    category: "custom-fields",
    categoryTitle: "Custom Fields",
    summary: "Extending your CRM data model with 11 custom field types, select options, and reordering.",
    requiredRole: "ADMIN",
    requiredPermission: { module: "settings", action: "manage" },
    tags: ["custom-fields", "schema", "fields", "types", "form"],
    content: `
# Configuring Dynamic Custom Fields

Every business is unique. Universal CRM allows administrators to add company-specific fields without altering database code or slowing down queries.

---

## 1. Supported Custom Field Types

Universal CRM supports 11 normalized field types:
1. **TEXT**: Single-line text (e.g. "VAT Number", "Referral Code").
2. **TEXTAREA**: Multi-line description (e.g. "Special Delivery Instructions").
3. **NUMBER**: Integers or floating-point figures (e.g. "Number of Employees").
4. **DATE**: Calendar date (\`YYYY-MM-DD\`).
5. **DATETIME**: Date with timestamp.
6. **BOOLEAN**: Yes / No checkbox or toggle.
7. **SELECT**: Single selection from a predefined whitelist of options.
8. **MULTI_SELECT**: Multiple tag selections from a whitelist.
9. **URL**: Web link with URL validation.
10. **EMAIL**: Email address with syntax validation.
11. **PHONE**: Contact phone number.

---

## 2. Managing Custom Fields (\`/app/settings/custom-fields\`)

1. Navigate to **Settings > Custom Fields**.
2. Click **+ Add Custom Field**.
3. Specify:
   - **Field Label**: Display name on forms and tables.
   - **Field Key**: Unique machine-readable identifier (e.g. \`budget_approved\`).
   - **Field Type**: Choose from the 11 supported types.
   - **Required**: Toggle whether this field is mandatory when creating leads.
   - **Options**: For \`SELECT\` and \`MULTI_SELECT\`, provide allowable choices.
4. Click **Save Field**.

---

## 3. Reordering & Soft Deletion

- **Reordering**: Fields are displayed on lead forms according to their \`sortOrder\`.
- **Soft Deletion**: Deleting a custom field hides it from future lead forms while preserving historical values on existing leads.
    `,
  },
  {
    slug: "users",
    title: "User Management & Email Invitations",
    category: "users",
    categoryTitle: "Users & Invitations",
    summary: "Inviting team members, assigning roles, managing account status, and executing admin password resets.",
    requiredRole: "ADMIN",
    requiredPermission: { module: "users", action: "view" },
    tags: ["users", "invitations", "admin", "passwords", "security"],
    content: `
# User Management & Email Invitations

The User Management workspace at \`/app/settings/users\` allows administrators to control team access, assign roles, and enforce security policies.

---

## 1. Inviting a New User

1. Navigate to **Settings > Users**.
2. Click **+ Invite User**.
3. Fill out:
   - **Full Name**: The user's name.
   - **Email Address**: The destination work email.
   - **Role**: Assign an initial system or custom role.
   - **Team**: Optionally assign the user to a departmental team.
4. Click **Send Invitation**.

### What happens behind the scenes:
- A cryptographically secure 32-byte token is generated.
- A **SHA-256 hash** of the token is saved in the database with a **7-day expiration**.
- An email is dispatched via \`EmailService\` with a link to \`/invite/[token]\`.
- The user is created in \`INVITED\` status with no password hash.

---

## 2. Disabling & Re-enabling Accounts

If an employee departs or an account is compromised:
1. Click the action menu (\`...\`) on the user's row and choose **Deactivate User**.
2. Confirm the action.

### Immediate Session Invalidation:
- When a user is \`DISABLED\`, their status is updated in the database.
- **All active DB sessions are immediately purged**.
- If the user attempts any API call or page navigation, edge middleware and server session validation reject the request with HTTP 401/403.

---

## 3. Admin Password Reset

If a user is locked out:
1. Click **Reset Password** on the user row.
2. Enter a new compliant temporary password.
3. Click **Reset Password**.
4. The password is encrypted with bcrypt (12 rounds), and all existing active sessions for that user are immediately revoked.
    `,
  },
  {
    slug: "teams",
    title: "Team Management & Departmental Rosters",
    category: "teams",
    categoryTitle: "Team Management",
    summary: "Creating functional teams, designating managers, and managing member rosters.",
    requiredRole: "ADMIN",
    requiredPermission: { module: "teams", action: "view" },
    tags: ["teams", "managers", "roster", "departments"],
    content: `
# Team Management & Departmental Rosters

Teams (\`/app/settings/teams\`) allow companies to group sales reps by territory, product line, or department, enabling departmental data scoping.

---

## 1. Creating a Team

1. Navigate to **Settings > Teams**.
2. Click **+ Create Team**.
3. Provide:
   - **Team Name**: e.g., "Enterprise Sales", "Inbound SDRs", "West Coast".
   - **Description**: Optional purpose or scope summary.
   - **Team Manager**: Designate an active user as manager.
4. Click **Create Team**.

> [!NOTE]
> When a manager is designated, they are automatically upserted into the \`team_members\` junction table so their roster is always synchronized.

---

## 2. Managing the Team Roster

Click on any team row to open the dedicated team view:
- **Add Member**: Click **+ Add Member**, select an active user, and add them to the team.
- **Remove Member**: Click **Remove** beside any member row to detach them from the roster.
- **Manager Badge**: The team manager is highlighted with a distinct shield badge.

---

## 3. Team Archiving

To retire a team without corrupting historical lead assignments:
1. Click **Archive Team** on the team card or detail view.
2. The team's \`isActive\` flag is set to \`false\`.
3. Leads and tasks previously assigned to the team remain intact, but the team can no longer receive new assignments.
    `,
  },
  {
    slug: "roles-permissions",
    title: "Roles, Permissions & Data Scopes",
    category: "roles-permissions",
    categoryTitle: "Roles & Permissions",
    summary: "System roles, custom role creation, granular module permissions, and data scope rules.",
    requiredRole: "ADMIN",
    requiredPermission: { module: "settings", action: "view" },
    tags: ["roles", "rbac", "permissions", "scopes", "security"],
    content: `
# Roles, Permissions & Data Scopes

Universal CRM implements a strict, centralized Role-Based Access Control (RBAC) model with multi-tenant data scoping.

---

## 1. The 5 Immutable System Roles

Every company account is seeded with 5 core system roles:
1. **Admin**: Complete administrative control over all modules, company settings, users, and audit logs.
2. **Manager**: Departmental leadership with \`TEAM\` scope over leads, tasks, and analytics.
3. **Sales Rep**: Frontline sales rep with \`OWN\` scope over assigned leads and follow-ups.
4. **Viewer**: Read-only access to company-wide leads and reports without editing rights.
5. **Support**: Operational support access for managing customer touchpoints.

> [!IMPORTANT]
> System roles have \`isSystem: true\` and cannot be deleted or renamed.

---

## 2. Custom Role Builder (\`/app/settings/roles\`)

Administrators can construct custom roles tailored to specific workflows:
1. Navigate to **Settings > Roles**.
2. Click **+ Create Custom Role**.
3. Enter a role name and description.
4. Configure permissions across the 8 core modules:
   - \`leads\` (\`view\`, \`create\`, \`update\`, \`delete\`, \`assign\`)
   - \`activities\` (\`view\`, \`create\`, \`update\`, \`delete\`)
   - \`tasks\` (\`view\`, \`create\`, \`update\`, \`delete\`)
   - \`analytics\` (\`view\`, \`export\`)
   - \`users\` (\`view\`, \`create\`, \`update\`, \`manage\`)
   - \`teams\` (\`view\`, \`create\`, \`update\`, \`manage\`, \`delete\`)
   - \`settings\` (\`view\`, \`manage\`)
   - \`audit_logs\` (\`view\`)
5. Select the **Data Scope** for each permission:
   - **OWN**: Restricted to records assigned to the caller.
   - **TEAM**: Restricted to records assigned to the caller's team.
   - **COMPANY**: Full organization visibility.
6. Click **Save Role**.

### Privilege Escalation Protections
- Non-administrators cannot grant permissions they do not possess.
- Custom roles cannot grant platform-level privileges.
    `,
  },
  {
    slug: "company-settings",
    title: "Company Profile & Localization Settings",
    category: "company-settings",
    categoryTitle: "Company Settings",
    summary: "Managing organization branding, logos, support contacts, timezone, currency, and date formats.",
    requiredRole: "ADMIN",
    requiredPermission: { module: "settings", action: "manage" },
    tags: ["company", "branding", "timezone", "currency", "settings"],
    content: `
# Company Profile & Localization Settings

The Company Settings page (\`/app/settings/company\`) configures your organization's identity and localization rules.

---

## 1. Branding & Identity

- **Company Name**: Your business's registered or trading name displayed in navigation and emails.
- **Company Slug**: Immutable multi-tenant URL slug.
- **Logo URL**: Public HTTPS URL to your company's logo icon.
- **Support Email & Phone**: Contact coordinates displayed on invitation emails and internal help banners.

---

## 2. Localization & Formats

- **Timezone**: Set your operating timezone (e.g. \`UTC\`, \`America/New_York\`, \`Europe/London\`, \`Asia/Kolkata\`). All backend dates are stored in UTC and rendered in your company timezone.
- **Currency**: Primary currency symbol (e.g. \`USD\`, \`EUR\`, \`GBP\`, \`INR\`, \`AED\`) applied to deal values, pipeline reports, and analytics.
- **Date Format**: Standardized display preference (\`YYYY-MM-DD\`, \`DD/MM/YYYY\`, or \`MM/DD/YYYY\`).

---

## 3. Audit Trail Integration

All updates made in Company Settings are atomically logged in the company's audit trail under the \`company_settings.updated\` action with a diff of modified fields.
    `,
  },
  {
    slug: "security",
    title: "Account Security & Active Session Management",
    category: "security",
    categoryTitle: "Security & Sessions",
    summary: "Self-service password changes, live active session viewer, and multi-device revocation.",
    tags: ["security", "password", "sessions", "revoke", "devices"],
    content: `
# Account Security & Active Session Management

Universal CRM provides self-service security tools at \`/app/settings/security\` so every user can monitor and protect their account.

---

## 1. Changing Your Password

1. Navigate to **Settings > Security**.
2. In the **Change Password** card:
   - Enter your **Current Password** (verified on the server).
   - Enter a **New Password** (minimum 8 characters, must contain uppercase, lowercase, number, and special character).
   - Confirm the new password.
3. Click **Update Password**.

> [!IMPORTANT]
> Changing your password automatically revokes all other active sessions across your other computers, phones, and tablets.

---

## 2. Active Session Viewer

The **Active Sessions** card displays every browser currently logged into your account:
- **Device & Browser**: Parsed User-Agent details (e.g. "Chrome on macOS", "Safari on iOS").
- **IP Address**: Origin IP address of the login.
- **Current Session Badge**: A green indicator marking the session you are currently using.
- **Last Active**: Timestamp of the most recent request.

---

## 3. Remote Session Revocation

If you suspect an unauthorized device or forgot to log out of a public computer:
- **Revoke Single Session**: Click the red **Revoke** button beside any specific session.
- **Sign Out All Other Devices**: Click **Sign Out All Other Devices** at the top of the session list to immediately invalidate every session except your current one.
    `,
  },
  {
    slug: "audit-logs",
    title: "Audit Log Explorer & Compliance",
    category: "audit-logs",
    categoryTitle: "Audit Trail",
    summary: "Reviewing append-only, tenant-isolated operational audit logs with JSON metadata inspectors.",
    requiredRole: "ADMIN",
    requiredPermission: { module: "audit_logs", action: "view" },
    tags: ["audit", "logs", "compliance", "history", "security"],
    content: `
# Audit Log Explorer & Compliance

The Audit Log Explorer (\`/app/settings/audit-logs\`) provides a tamper-proof, append-only history of every meaningful operation executed within your company.

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
- **Action Filter**: Filter by action name (e.g. \`auth.login\`, \`lead.deleted\`, \`user.status_updated\`).
- **Entity Type**: Filter by target entity (e.g. \`Lead\`, \`User\`, \`Team\`, \`Company\`).
- **User Filter**: Isolate actions taken by a specific team member.
- **Date Range**: Set start and end boundaries.

---

## 3. JSON Metadata & Diff Inspector

Click the **View Details** button on any audit record to open the structured JSON modal inspector:
- **Actor Details**: Actor ID, IP address, and User-Agent.
- **State Diffs**: Previous values and new values for modified records.
- **Immutability Guarantee**: Audit logs are read-only and strictly tenant-isolated. No API or user interface exists to modify or delete audit log entries.
    `,
  },
  {
    slug: "faq",
    title: "Frequently Asked Questions (FAQ)",
    category: "faq",
    categoryTitle: "FAQ",
    summary: "Direct answers to the most common operational and administrative questions.",
    tags: ["faq", "help", "questions", "answers"],
    content: `
# Frequently Asked Questions (FAQ)

### Q: Why can't I see all the leads in my company?
**A:** Universal CRM enforces strict **Data Scoping**. If you have a **Sales Rep** role, you can only see leads assigned directly to you (\`OWN\` scope). If you have a **Manager** role, you see leads assigned to members of your team (\`TEAM\` scope). Only **Admins** have organization-wide visibility (\`COMPANY\` scope).

---

### Q: What happens when an invitation token expires?
**A:** Invitation tokens expire after 7 days. If an invite expires, an administrator can simply open **Settings > Users** and re-send an invitation to generate a fresh 7-day token.

---

### Q: If a user is deactivated, can they still log in?
**A:** No. When a user's status is changed to \`DISABLED\`, all active sessions are instantly purged from the database. Any existing session token is rejected immediately on the next request.

---

### Q: Can deleted leads be recovered?
**A:** Leads are soft-deleted by applying a \`deletedAt\` timestamp. While they do not appear in normal CRM tables or searches, their historical activities, assignments, and audit logs remain intact in the database.

---

### Q: How are duplicate leads detected during CSV import?
**A:** The import wizard checks for existing leads matching either the **Email** or **Phone** number within your company. You can choose whether to \`SKIP\` duplicate rows, \`UPDATE\` existing leads with the CSV data, or \`CREATE\` new records anyway.

---

### Q: Can custom fields be exported?
**A:** Yes. When you click **Export CSV** on the Leads page, all active custom fields are included as columns in the exported spreadsheet.
    `,
  },
];
