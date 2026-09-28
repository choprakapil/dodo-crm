# Universal CRM — User Guide

A practical, step-by-step operating guide for sales representatives, account managers, and customer-facing staff using Universal CRM.

---

## Table of Contents
1. [Getting Started](#1-getting-started)
2. [Executive Dashboard](#2-executive-dashboard)
3. [Lead Management](#3-lead-management)
4. [Activities & Interactions](#4-activities--interactions)
5. [Follow-up Tasks & Reminders](#5-follow-up-tasks--reminders)
6. [Lead Import & Export](#6-lead-import--export)
7. [Dynamic Custom Fields](#7-dynamic-custom-fields)
8. [Account Security & Active Sessions](#8-account-security--active-sessions)

---

## 1. Getting Started

### 1.1 Logging In
1. Open your web browser and navigate to the CRM login page at `/login`.
2. Enter your registered work email address and password.
3. Click **Sign In**.
4. Upon authentication, you will be redirected directly to your CRM workspace at `/app`.

> [!NOTE]
> Sessions remain active for 24 hours of inactivity. All sessions are cryptographically signed and stored in the database.

### 1.2 Top Navigation Overview
The persistent navigation header provides one-click access across all primary modules:
- **Dashboard (`/app`)**: Executive KPIs, conversion trends, and team productivity.
- **Leads (`/app/leads`)**: Full opportunity table, filters, prospecting, and detail cards.
- **Follow-ups (`/app/follow-ups`)**: Daily scheduled calls, meetings, and task queues.
- **Settings (`/app/settings/*`)**: Account preferences, security, and administrative configurations.
- **Help (`/app/help`)**: Contextual documentation and operating guides.

### 1.3 Data Scope & Lead Visibility
Universal CRM enforces strict role-based data scoping:
- **Sales Rep (`OWN` scope)**: You will only see leads, tasks, and activities assigned directly to you.
- **Manager (`TEAM` scope)**: You will see leads, tasks, and activities assigned to any member of your designated team.
- **Admin (`COMPANY` scope)**: Full visibility across the entire company.

If a lead seems "missing" from your list, verify with your manager whether the lead has been assigned to you.

---

## 2. Executive Dashboard

The home workspace at `/app` displays your sales health in real time.

### 2.1 The 6 Core KPI Cards
1. **Total Leads**: Total non-deleted leads currently within your data scope.
2. **New Leads**: Count of leads created within the selected timeframe, alongside a percentage delta vs. the preceding comparison period.
3. **Converted Leads**: Opportunities that have reached a winning conversion stage (`CONVERTED` or `WON`).
4. **Conversion Rate**: Percentage of opportunities successfully converted (`Converted / Total * 100`).
5. **Pipeline Value**: Total deal value of all open, active opportunities.
6. **Follow-ups Due**: Scheduled tasks due today or currently overdue requiring attention.

### 2.2 Time-Series Trend Chart
The responsive SVG area chart visualizes lead creation velocity over time:
- **Interval Buckets**: Automatically groups data by **Day** (ranges up to 31 days), **Week** (up to 90 days), or **Month** (exceeding 90 days).
- **Hover Inspection**: Hover over any point on the chart line to reveal the exact date and volume of acquired leads.
- **Zero-Baseline**: Dates with zero acquisitions display a true 0, avoiding deceptive scale distortion.

### 2.3 Status & Channel Breakdowns
- **Status Distribution**: Visual meter of leads across pipeline stages (e.g. New, Contacted, Qualified, Proposal, Won, Lost).
- **Source Breakdown**: Acquisition volume and pipeline values across lead sources (Website, Referral, Google, LinkedIn, etc.).
- **Pipeline Overview**: High-level win rate gauge, active deals, won revenue, and average deal size.

---

## 3. Lead Management

### 3.1 Creating a Lead
1. Navigate to `/app/leads` and click the **+ New Lead** button.
2. Fill out the lead form:
   - **Lead Name** *(Required)*: Contact or decision maker name.
   - **Company**: Organization or business name.
   - **Email & Phone**: Primary contact information.
   - **Deal Value**: Numerical opportunity value in company currency.
   - **Status**: Starting stage (defaults to your company's default status).
   - **Source**: Acquisition channel.
   - **Priority**: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
   - **Assignee**: Designate a team member (or assign to yourself).
   - **Custom Fields**: Dynamic company-specific attributes.
3. Click **Create Lead**.

### 3.2 Searching & Filtering
The Leads table provides instant filtering:
- **Search**: Type into the search field to filter across **Lead Name**, **Company**, **Email**, and **Phone**.
- **Status Dropdown**: Filter by one or more pipeline stages.
- **Source Dropdown**: Filter by acquisition source.
- **Priority Filter**: Focus exclusively on urgent or high-value opportunities.

### 3.3 Lead Detail View (`/app/leads/[id]`)
Click on any lead to open its comprehensive operational profile:
- **Summary Header**: Quick status selector and one-click assignee dropdown.
- **Overview Card**: Opportunity value, contact coordinates, source, priority, and team.
- **Custom Fields Card**: Formatted display of company-specific attributes.
- **Timeline & History**: Complete chronological feed of every interaction and status update.

### 3.4 Soft Deletion
Deleting a lead applies a `deletedAt` timestamp. The lead is removed from active tables, searches, and metrics, but its historical activity logs and audit trail remain preserved for auditing.

---

## 4. Activities & Interactions

### 4.1 Supported Channels
Log customer touchpoints directly against any lead:
- 📞 **Call**: Phone conversations with duration, outcome, and notes.
- 💬 **WhatsApp**: Messaging correspondence and chat summaries.
- ✉️ **Email**: Proposals sent, replies received, or email updates.
- 🤝 **Meeting**: Video conferences or in-person sales presentations.
- 📝 **Note**: Internal strategy thoughts, background context, or observations.

### 4.2 Logging an Activity
1. Open the lead detail view at `/app/leads/[id]`.
2. Click **+ Log Activity**.
3. Select the **Activity Type**.
4. Enter a **Subject** (e.g., "Product demo call with VP of Sales").
5. Write detailed notes in the **Description** field.
6. Click **Save Activity**. The entry appears instantly at the top of the timeline.

---

## 5. Follow-up Tasks & Reminders

### 5.1 Scheduling a Follow-up
1. On any lead detail page, click **+ Schedule Follow-up**.
2. Enter:
   - **Title**: Actionable description (e.g., "Follow up on pricing contract").
   - **Due Date & Time**: Target completion timestamp.
   - **Priority**: `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
   - **Assignee**: Responsible team member.
3. Click **Create Follow-up**.

### 5.2 The Follow-up Workspace (`/app/follow-ups`)
Navigate to `/app/follow-ups` to review your task queue:
- **Today**: Reminders due today.
- **Overdue**: Past-due tasks requiring immediate escalation.
- **Upcoming**: Scheduled future tasks.
- **All Follow-ups**: Unfiltered view across your task queue.
- **Completed**: Completed history.
- **Cancelled**: Dismissed reminders.

### 5.3 One-Click Completion
Click the green **Complete** button next to any task. The task transitions to `COMPLETED`, recording your name and timestamp, and automatically writes a `TASK_COMPLETED` milestone on the associated lead's timeline.

---

## 6. Lead Import & Export

### 6.1 Importing Leads from CSV
1. Go to `/app/leads` and click **Import Leads**.
2. **Upload**: Select or drop your `.csv` file.
3. **Map Columns**: Review detected headers and map them to standard fields (Name, Email, Phone, Deal Value, etc.) or custom fields.
4. **Duplicate Handling**: Choose between:
   - `SKIP`: Ignores rows with matching email or phone.
   - `UPDATE`: Overwrites existing lead information with CSV values.
   - `CREATE`: Creates duplicate records regardless of matches.
5. **Execute**: The batch engine processes 100 rows per transaction.
6. **Error Summary**: If any rows fail validation, download the error CSV to inspect row numbers and specific reasons.

### 6.2 Exporting Leads to CSV
Click **Export CSV** in the Leads table toolbar. The system generates an RFC 4180 compliant CSV respecting your permissions and active custom fields.

> [!NOTE]
> Exported CSVs automatically neutralize formula injection by prepending `'` to cells starting with `=`, `+`, `-`, or `@`.

---

## 7. Dynamic Custom Fields

Your organization can configure up to 11 custom field types to capture bespoke business data:
1. **Text**: Single-line string (e.g. "Tax ID").
2. **Textarea**: Multi-line notes.
3. **Number**: Integer or floating-point numerical values.
4. **Date**: `YYYY-MM-DD` calendar dates.
5. **Datetime**: Date and time values.
6. **Boolean**: True/False toggle.
7. **Select**: Single choice from an approved option list.
8. **Multi-Select**: Multiple tag choices.
9. **URL**: Web links.
10. **Email**: Email address with syntax validation.
11. **Phone**: Phone numbers.

---

## 8. Account Security & Active Sessions

Manage your account credentials at `/app/settings/security`.

### 8.1 Changing Your Password
- Requires entering your **Current Password**.
- New password must be at least 8 characters and include uppercase, lowercase, number, and special character.
- Updating your password **automatically revokes all other active sessions** across other computers and mobile devices.

### 8.2 Active Session Management
The **Active Sessions** list displays every browser currently logged into your account:
- Shows device, browser, IP address, and last activity timestamp.
- Identifies your current session with a green badge.
- Click **Revoke** on any device to log it out immediately.
- Click **Sign Out All Other Devices** to terminate every session except your current one.

---

## 9. Customer Directory & Relationship Management

Universal CRM provides a centralized, multi-tenant customer identity layer accessible at `/app/customers`.

### 9.1 The Fundamental Rule: ONE CUSTOMER ≠ ONE ENQUIRY
- A **Customer** represents a persistent person or organization identity.
- An **Enquiry** (Lead) represents a specific, time-bounded commercial transaction or opportunity.
- Rahul can have a TV enquiry (Converted), a Mobile enquiry (Open), and an AC enquiry (Closed).
- Editing or soft-deleting a Customer **never** cancels, closes, reassigns, or deletes the customer's linked enquiries.

### 9.2 Browsing & Searching Customers (`/app/customers`)
- Navigate to **Customers** in the top navigation bar.
- Search instantly by name, organization name, phone number, or email address.
- Phone search automatically normalizes input to match formatted or raw numbers.
- View primary contact points and total linked enquiry counts.

### 9.3 Customer Profile & Authorized Enquiry History (`/app/customers/[id]`)
- Access a customer's detailed profile to inspect notes, company affiliations, and contact points.
- **Data Scope Enforcement**: The customer profile's enquiry history strictly applies your role's Data Scope (`OWN`, `TEAM`, or `COMPANY`).
  - A Sales Representative with `OWN` scope sees only their assigned enquiries for that customer.
  - Opportunities assigned to other representatives remain confidential and are never leaked through the customer profile.

### 9.4 Contact Management
- Click **Add Phone** or **Add Email** to attach secondary contact channels (Mobile, Work, Home, WhatsApp).
- Use **Make Primary** to designate which phone/email is the authoritative primary contact.
- When deleting a primary contact point, the CRM automatically designates the oldest remaining contact as primary to ensure identity records remain valid.
