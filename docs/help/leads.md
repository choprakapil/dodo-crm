# Lead Management & Opportunity Tracking

The Leads workspace (`/app/leads`) is the core operational table where sales opportunities are captured, assigned, and moved through your sales cycle.

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
> Creating a lead automatically writes a `LEAD_CREATED` entry into the lead's activity timeline and generates an immutable audit log.

---

## 2. Searching & Filtering Leads

The filter bar allows high-speed filtering across large volumes:
- **Live Search**: Type into the search input to instantly filter across **Lead Name**, **Company**, **Email**, and **Phone**.
- **Status Filter**: Filter by one or multiple sales pipeline statuses.
- **Source Filter**: Filter by lead acquisition channel.
- **Priority Filter**: Focus on `HIGH` or `URGENT` priority deals.

---

## 3. Lead Detail View (`/app/leads/[id]`)

Clicking on any lead row opens the comprehensive Lead Detail page:
- **Opportunity Summary Banner**: Quick status selector and one-click assignee dropdown.
- **Overview Card**: Phone, email, company, deal value, source, and priority.
- **Custom Fields Card**: Formatted display of dynamic business fields.
- **Activity & History Timeline**: Complete chronological record of every call, meeting, status change, and reassignment.

---

## 4. Soft Deletion

When a lead is deleted:
- It is not permanently wiped from the database. Instead, a `deletedAt` timestamp is applied.
- The lead is excluded from standard lists, searches, and analytics counts.
- Historical audit logs and activities remain intact for compliance.
