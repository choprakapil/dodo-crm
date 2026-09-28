# Universal CRM — Lead Intelligence & Full CRM Customization
## Complete Architecture Review, Gap Analysis, Database Design, API Design, Business Logic Design, UX Architecture, Security Review, Performance Review, Migration Strategy & Implementation Roadmap

**Document Type:** ARCHITECTURAL SPECIFICATION & SYSTEM BLUEPRINT  
**Status:** DRAFT ARCHITECTURE (REVIEW ONLY — ZERO IMPLEMENTATION PERFORMED)  
**Baseline System State:** Universal CRM V1.0 (Slices 1–8 Locked & Production Ready)  
**Target Scale:** 20,000–30,000 users, millions of enquiries, multi-tenant fleet  
**Date:** 2026-09-17  
**Author:** Antigravity Principal Systems Architect & Engineering Team  

---

## Executive Architectural Summary

Universal CRM is evolving from a single-tier lead tracking tool into a cross-industry, highly customizable **Universal CRM Engine**. The platform must support diverse business models (Retail, Healthcare, Education, Real Estate, Professional Services, Finance, B2B, B2C, Call Centers, Subscriptions) without hardcoding industry-specific schemas or business rules.

### The Foundational Architectural Paradigm
The single most critical invariant of this architecture is:

$$\mathbf{CUSTOMER \neq ENQUIRY}$$
$$\mathbf{ONE\ CUSTOMER \longrightarrow MANY\ ENQUIRIES}$$

1. **Customer Identity** represents the long-term human or corporate relationship with the tenant organization. It persists across years, transcends individual marketing campaigns, and holds multiple phone numbers, emails, and corporate identifiers.
2. **Enquiry (Opportunity / Sales Lead)** represents a distinct, transactional expression of interest, requirement, or sales opportunity (e.g. buying a Television today, enquiring about a Mobile Phone six months later, or requesting AMC service next year).
3. **Independent Lifecycle**: Each enquiry progresses through its own lifecycle (Open, In-Progress, Disposed, Converted, or Closed) completely independently. A previous converted enquiry never automatically closes or converts a newly opened enquiry.
4. **Data Visibility is Scope-Governed**: While Customer identity is company-wide, **Customer Data Visibility is strictly filtered** by the existing RBAC and Data Scope engine (`OWN`, `TEAM`, `COMPANY`). An agent assigned to Enquiry #2 cannot see Enquiry #1 unless authorized.

---

## 1. Current Architecture Analysis

Universal CRM V1.0 consists of a multi-tenant modular monolith built on Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL 16, and Prisma 5.x.

### 1.1 Current Lead Model (`prisma/schema.prisma` lines 414–453)
- **Structure**: The `Lead` entity currently combines customer identity and the sales transaction into a single row:
  - Identity fields: `name`, `email`, `phone`, `company` (lead's company).
  - Transaction fields: `sourceId`, `statusId`, `assignedUserId`, `teamId`, `priority`, `amount`.
  - Lifecycle tracking: `deletedAt` (soft-delete), `statusHistories` (`LeadStatusHistory`), `assignmentHistories` (`LeadAssignmentHistory`).
  - Attached collections: `activities` (`Activity`), `notes` (`Note`), `tasks` (`Task` / Follow-ups), `customFieldValues` (`CustomFieldValue`).
- **Defect in Current Model**: If customer "Rahul Sharma" contacts the business for a second product, the system either:
  - Overwrites the existing lead (destroying the historical record of the first sale), OR
  - Creates a duplicate `Lead` record, resulting in two separate "Rahul Sharmas", fragmenting communication history, customer lifetime value, and phone searches.

### 1.2 Current CustomField Architecture (`schema.prisma` lines 628–686)
- **Schema**: `CustomField` stores metadata (`key`, `label`, `fieldType`, `required`, `active`, `sortOrder`, `options` JSON). Crucially, it already contains `entityType: String @default("LEAD")`.
- **Value Storage**: `CustomFieldValue` stores `entityType: String @default("LEAD")`, `entityId: String`, and `value: Json?`.
- **Strengths**: Extremely well-designed, normalized, and already parameterizes `entityType`. It supports 11 data types: `TEXT`, `TEXTAREA`, `NUMBER`, `DATE`, `DATETIME`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, `URL`, `EMAIL`, `PHONE`.
- **Reusability**: 100% reusable. By supporting `entityType: "CUSTOMER"`, `entityType: "ENQUIRY"`, and `entityType: "OFFERING"`, we can power custom fields across all domains without creating a duplicate engine.

### 1.3 Current Task & Follow-up Architecture (`schema.prisma` lines 559–594)
- **Schema**: `Task` model stores `leadId`, `assignedUserId`, `title`, `description`, `dueAt` (UTC), `priority`, `status` (`PENDING`, `COMPLETED`, `CANCELLED`), `completedAt`, `cancelledAt`.
- **Operational Workspace**: `/app/follow-ups` provides tabbed task management (Today, Overdue, Upcoming, Completed).
- **Reusability**: Follow-ups are already modeled as tasks linked to a `leadId`. Callbacks and reminders should continue using this exact table rather than introducing separate tables.

### 1.4 Current Analytics Architecture (`lib/services/analytics.service.ts`)
- Computes lead creation trends, dynamic status breakdowns, source acquisition pipelines, and team leaderboards via batched Prisma `groupBy` queries.
- **Limitation**: All aggregations currently count `Lead` rows. It cannot differentiate between "Total Customers" and "Total Enquiries", nor compute "Repeat Customer Rate" or "Customer Lifetime Value".

### 1.5 Current RBAC & Data Scope (`lib/auth/scope.ts`)
- **Scopes**: `OWN` (sales rep can only view self-assigned records), `TEAM` (manager can view team-assigned records), `COMPANY` (admin can view all company records), `PLATFORM` (super admin).
- **Enforcement**: Dynamically constructed Prisma `where` clauses (`where: { companyId: ctx.company.id, assignedUserId: ctx.user.id }`).
- **Security Rule**: Client-supplied tenant IDs or user IDs are completely ignored. Server-side `AuthContext` is authoritative.

---

## 2. Gap Analysis

| Capability Area | What Currently Exists | What Is Missing | Architectural Strategy |
|---|---|---|---|
| **Customer Identity** | Flat fields on `Lead` (`name`, `phone`, `email`). | Dedicated `Customer`, `CustomerPhone`, `CustomerEmail` models. | Create Customer Identity layer; link existing `Lead` as `Enquiry` to `Customer`. |
| **Phone Handling** | Single raw string `phone` on `Lead`. No normalization. | Phone normalization (E.164), country codes, multi-phone support, primary phone flag. | Implement `CustomerPhone` with `normalizedPhone` and indexed tenant uniqueness. |
| **Repeat Enquiries** | Re-creating a lead creates a duplicate person. | Ability for one Customer to spawn multiple independent Enquiries over time. | Enforce Customer-to-Enquiry 1:N relationship. Resolve Customer before creating Enquiry. |
| **Dispositions** | Flat `LeadStatus` (`New`, `Contacted`, `Converted`, `Lost`). | Arbitrary depth hierarchical tree (Category → Subcategory → Reason) and behavioral rules. | Implement `Disposition` tree with `parentId` and `DispositionRule` engine. |
| **Follow-up Rules** | Manual date picker on follow-up creation. | Rule-driven enforcement (e.g. "Call Tomorrow" forces mandatory follow-up creation). | Link Dispositions to `DispositionRule` enforcing task creation before save. |
| **Product / Offering** | Freeform `amount` and text custom fields on `Lead`. | Catalog of `Offerings` (Products, Services, Packages, Subscriptions) with pricing and metadata. | Implement generic `Offering` and `OfferingCategory` models. |
| **Conversion** | Status change to "Converted". | Structured `Conversion` entity capturing value, offering, timestamp, agent, and conversion notes. | Implement `Conversion` table linking Enquiry to Offering and Customer history. |
| **Customer History** | Per-lead activity timeline. | Aggregated, scope-filtered Customer 360 view showing past enquiries, conversions, and activities. | Customer Timeline querying authorized Enquiries, Activities, and Follow-ups. |
| **Dashboard** | Fixed executive dashboard widgets. | Configurable widgets, customer vs. enquiry metrics, and server-side clickable drill-downs. | Implement `DashboardWidget` configuration and server-side drill-down query resolver. |
| **Customer Merge** | Not possible. | Safe, audited merging of duplicate customer records with phone and enquiry re-parenting. | Dedicated `CustomerMergeService` with transactional migration and audit logging. |

---

## 3. Customer Architecture & Domain Relationships

```text
                                 +-------------------------+
                                 |         COMPANY         |
                                 |       (Tenant Root)     |
                                 +------------+------------+
                                              |
                                              v
                                 +-------------------------+
                                 |        CUSTOMER         |
                                 |   (Long-term Identity)  |
                                 +------+-----------+------+
                                        |           |
             +--------------------------+           +--------------------------+
             |                                                                 |
             v                                                                 v
+-------------------------+                                       +-------------------------+
|      CUSTOMER_PHONE     |                                       |      CUSTOMER_EMAIL     |
|  rawPhone               |                                       |  email                  |
|  normalizedPhone (E.164)|                                       |  isPrimary: Boolean     |
|  isPrimary: Boolean     |                                       |  isVerified: Boolean    |
+-------------------------+                                       +-------------------------+
                                        |
                                        v
                         +-----------------------------+
                         |      ENQUIRY (LEAD)         |
                         |   (Transactional Instance)  |
                         +--------------+--------------+
                                        |
       +--------------------+-----------+-----------+--------------------+
       |                    |                       |                    |
       v                    v                       v                    v
+--------------+     +--------------+        +--------------+     +--------------+
|   OFFERING   |     |  DISPOSITION |        |   ACTIVITY   |     |     TASK     |
| Product/Svc  |     | Tree Node    |        | Calls/Notes  |     | (Follow-up)  |
+--------------+     +--------------+        +--------------+     +--------------+
                            |
                            v
                     +--------------+
                     |  CONVERSION  |
                     | Won Deal Log |
                     +--------------+
```

### Why Customer and Enquiry Must Remain Completely Separate
1. **Temporal Reality**: A customer exists continuously for years. An enquiry is opened on Tuesday, worked for 4 days, and either converted or closed.
2. **Multiple Simultaneous Needs**: A customer may have an active open enquiry for a "Mobile Phone" while simultaneously having an active support enquiry for a "Television AMC".
3. **Attribution & Commissions**: Enquiry #1 was converted by Agent Amit in January. Enquiry #2 is worked by Agent Priya in June. If Customer and Enquiry are conflated, Agent Priya's work would either overwrite Amit's metrics or split the customer into two fictional people.
4. **Accurate Repeat Metrics**: Cohort analysis and Lifetime Value (LTV) require counting:
   $$\text{LTV} = \sum_{\text{all conversions}} \text{Conversion Amount}$$
   If every enquiry is a separate customer, repeat purchase rate is mathematically impossible to calculate.

---

## 4. Database Design (Prisma Schema Specification)

### 4.1 Safe Evolutionary Strategy (Option A: Keep `Lead` as `Enquiry`)
To guarantee **zero downtime, zero breaking changes to existing APIs, and 100% preservation of historical data**, we preserve the existing `leads` table and add `customerId String?` as a foreign key. All existing tables (`activities`, `notes`, `tasks`, `lead_status_histories`, `lead_assignment_histories`, `custom_field_values`) remain completely intact!

### 4.2 Proposed New & Modified Prisma Models

```prisma
// =============================================================================
// CUSTOMER IDENTITY LAYER
// =============================================================================

model Customer {
  id          String    @id @default(cuid())
  companyId   String
  name        String
  displayName String?
  avatarUrl   String?
  companyName String?   // Organization / employer if B2B
  notes       String?   @db.Text
  deletedAt   DateTime? // Soft delete
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  company     Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  phones      CustomerPhone[]
  emails      CustomerEmail[]
  enquiries   Lead[]           // Relates to existing Lead table (operating as Enquiries)
  conversions Conversion[]

  @@index([companyId])
  @@index([companyId, name])
  @@index([companyId, deletedAt])
  @@map("customers")
}

model CustomerPhone {
  id              String   @id @default(cuid())
  companyId       String
  customerId      String
  rawPhone        String
  normalizedPhone String   // E.164 format: e.g. "+919876543210"
  countryCode     String?  // ISO: e.g. "IN", "US"
  type            String   @default("MOBILE") // MOBILE, WORK, HOME, WHATSAPP
  isPrimary       Boolean  @default(false)
  isVerified      Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  company  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  // Enforces unique normalized phone within the tenant organization
  @@unique([companyId, normalizedPhone])
  @@index([companyId, customerId])
  @@index([companyId, normalizedPhone])
  @@map("customer_phones")
}

model CustomerEmail {
  id         String   @id @default(cuid())
  companyId  String
  customerId String
  email      String
  type       String   @default("WORK") // WORK, PERSONAL
  isPrimary  Boolean  @default(false)
  isVerified Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  company  Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  customer Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([companyId, email])
  @@index([companyId, customerId])
  @@map("customer_emails")
}

// =============================================================================
// OFFERINGS (PRODUCTS / SERVICES / PACKAGES)
// =============================================================================

enum OfferingType {
  PRODUCT
  SERVICE
  PACKAGE
  PLAN
  PROGRAM
  SUBSCRIPTION
  OTHER
}

model OfferingCategory {
  id          String   @id @default(cuid())
  companyId   String
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company   Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  offerings Offering[]

  @@unique([companyId, name])
  @@index([companyId])
  @@map("offering_categories")
}

model Offering {
  id          String       @id @default(cuid())
  companyId   String
  categoryId  String?
  name        String
  code        String?      // SKU or internal reference code
  type        OfferingType @default(PRODUCT)
  description String?      @db.Text
  basePrice   Decimal?     @db.Decimal(15, 2)
  currency    String       @default("USD")
  isActive    Boolean      @default(true)
  metadata    Json?        // Flexible industry-specific attributes
  deletedAt   DateTime?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  company     Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  category    OfferingCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  enquiries   Lead[]
  conversions Conversion[]

  @@unique([companyId, code])
  @@index([companyId, type, isActive])
  @@map("offerings")
}

// =============================================================================
// HIERARCHICAL DISPOSITIONS & BUSINESS RULES
// =============================================================================

model Disposition {
  id           String   @id @default(cuid())
  companyId    String
  parentId     String?  // Null for top-level categories
  name         String
  code         String?  // e.g. "BUSY", "NOT_INTERESTED_PRICE"
  color        String?  @default("#64748b")
  displayOrder Int      @default(0)
  isTerminal   Boolean  @default(false) // True if this leaf disposition concludes an action
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company   Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  parent    Disposition?     @relation("DispositionHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children  Disposition[]    @relation("DispositionHierarchy")
  rule      DispositionRule?
  enquiries Lead[]

  @@unique([companyId, parentId, name])
  @@index([companyId, parentId])
  @@map("dispositions")
}

model DispositionRule {
  id                String   @id @default(cuid())
  dispositionId     String   @unique
  companyId         String
  requiresFollowUp  Boolean  @default(false) // If true, agent must schedule a task
  followUpMandatory Boolean  @default(false) // If true, cannot submit without followUpAt
  allowsClose       Boolean  @default(true)  // If false, enquiry must stay OPEN
  closesEnquiry     Boolean  @default(false) // If true, automatically transitions status to CLOSED
  setsStatusId      String?  // Optional: automatically transition to specific LeadStatus
  requiresNote      Boolean  @default(false) // If true, description/note is mandatory
  triggersConversion Boolean @default(false) // If true, opens conversion modal
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  disposition Disposition @relation(fields: [dispositionId], references: [id], onDelete: Cascade)
  company     Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@map("disposition_rules")
}

// =============================================================================
// FOLLOW-UP LIFECYCLE & TASK RESCHEDULE AUDIT (REUSING TASK MODEL)
// =============================================================================

// Extends existing Task model with full lifecycle status
// enum TaskStatus {
//   PENDING
//   COMPLETED
//   RESCHEDULED
//   CANCELLED
//   OVERDUE
// }

model TaskRescheduleHistory {
  id              String      @id @default(cuid())
  companyId       String
  taskId          String
  leadId          String
  previousDueAt   DateTime
  newDueAt        DateTime?
  action          String      // "RESCHEDULED" | "COMPLETED" | "CANCELLED" | "OVERDUE"
  dispositionId   String?
  reason          String?     @db.Text
  userId          String
  createdAt       DateTime    @default(now())

  task        Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  company     Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  lead        Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)
  user        User         @relation(fields: [userId], references: [id])
  disposition Disposition? @relation(fields: [dispositionId], references: [id])

  @@index([companyId, taskId])
  @@index([companyId, leadId])
  @@map("task_reschedule_histories")
}

// =============================================================================
// CONVERSIONS (SALES OUTCOMES)
// =============================================================================

model Conversion {
  id           String   @id @default(cuid())
  companyId    String
  customerId   String
  enquiryId    String   @unique // 1:1 with the Lead/Enquiry that converted
  offeringId   String?
  convertedById String
  amount       Decimal  @db.Decimal(15, 2)
  currency     String   @default("USD")
  notes        String?  @db.Text
  metadata     Json?    // Industry-specific conversion details (invoice#, policy#, etc.)
  convertedAt  DateTime @default(now())
  createdAt    DateTime @default(now())

  company     Company   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  customer    Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  enquiry     Lead      @relation(fields: [enquiryId], references: [id], onDelete: Cascade)
  offering    Offering? @relation(fields: [offeringId], references: [id], onDelete: SetNull)
  convertedBy User      @relation(fields: [convertedById], references: [id])

  @@index([companyId, customerId])
  @@index([companyId, convertedAt])
  @@index([companyId, convertedById])
  @@map("conversions")
}

// =============================================================================
// MODIFIED LEAD MODEL (Operating as Enquiry)
// =============================================================================

// In addition to all existing Lead fields:
// Add: customerId, offeringId, dispositionId, parentEnquiryId
```

---

## 5. Customer Identity Resolution & Duplicate Prevention

### 5.1 Phone Normalization Standard
Phone numbers must be normalized into strict **E.164 format** before database comparison:
1. Strip all formatting noise: spaces, hyphens, brackets, dots (` `, `-`, `(`, `)`, `.`).
2. Country code resolution:
   - If number starts with `+`, validate against international E.164 length (8 to 15 digits).
   - If number starts without `+` and has 10 digits (e.g. `9876543210` in India), prepend the tenant company's default country calling code (e.g. `+91`).
   - If leading `0` exists (e.g. `09876543210`), strip leading zero and prepend tenant country code.
3. Example Result: `98765-43210`, `+91 98765 43210`, and `09876543210` all resolve deterministically to:
   $$\mathbf{+919876543210}$$

### 5.2 Resolution Algorithm (`CustomerResolutionService`)

```text
Input: rawPhone, rawEmail, name
      │
      ▼
1. Normalize Phone → normalizedPhone (+919876543210)
      │
      ▼
2. Query customer_phones WHERE companyId = ctx.company.id AND normalizedPhone = :normalizedPhone
      │
      ├───────────────────────────────┬───────────────────────────────┐
      │ Exact Match Found             │ No Phone Match Found          │
      ▼                               ▼                               ▼
Return Existing Customer Identity   3. Query customer_emails (if email provided)
(Display Name, Past Enquiries)        │
                                      ├───────────────────────────────┬───────────────────────────────┐
                                      │ Email Match Found             │ No Match Found                │
                                      ▼                               ▼                               ▼
                                    Return Existing Customer        Return NULL (Prompt agent:      │
                                    (Display Name, Past Enquiries)  Create New Customer Identity)   │
```

### 5.3 Customer Merge Architecture
When two customer profiles accidentally exist (e.g. Rahul Sharma registered with phone A, and later created under phone B):
- **Authorization**: Requires `customers.manage` permission (Admin/Manager).
- **Execution (`POST /api/v1/customers/:id/merge`)**:
  - `sourceCustomerId` (to be merged and soft-deleted).
  - `destinationCustomerId` (surviving primary customer identity).
  - In a single database `$transaction`:
    1. Re-parent all `customer_phones` from source to destination (skipping duplicates).
    2. Re-parent all `customer_emails` from source to destination.
    3. Re-parent all `leads` (enquiries) from source to destination.
    4. Re-parent all `conversions` from source to destination.
    5. Soft-delete source customer: `deletedAt = now()`.
    6. Record immutable audit log: `CUSTOMER_MERGED` with metadata `{ sourceId, destinationId, enquiriesMoved, phonesMoved }`.

---

## 6. Enquiry Lifecycle & Interaction Model

```text
   [Initiate]
       │
       ▼
[Resolve Customer] ─── (Matches Existing Customer?)
       │                      │
       ├────── YES ───────────┤ Shows customer's prior purchases & active deals
       │                      │
       ▼                      ▼
[New Customer Form]   [Existing Customer Profile]
       │                      │
       └──────────┬───────────┘
                  │
                  ▼
         [Select Offering] (TV, Mobile, Consultation, Course, etc.)
                  │
                  ▼
         [Dynamic Fields] (Budget, Requirement, City, Specs)
                  │
                  ▼
         [Assign Agent/Team]
                  │
                  ▼
         [Status: NEW / OPEN]
                  │
                  ▼
       [Customer Interaction] (Call / WhatsApp / Meeting)
                  │
                  ▼
       [Select Hierarchical Disposition]
                  │
                  ├───────────────────────────────┬───────────────────────────────┐
                  ▼                               ▼                               ▼
         "Call Tomorrow"                 "Not Interested"                "Ready to Purchase"
                  │                               │                               │
         [Rule Enforced]                 [Rule Enforced]                 [Rule Enforced]
         • Follow-up Mandatory           • Allows Close = True           • Triggers Conversion
         • Create Task with dueAt        • Closes Enquiry                • Record Conversion Deal
         • Enquiry Remains OPEN          • Status: LOST / CLOSED         • Status: WON / CONVERTED
```

---

## 7. Hierarchical Disposition Tree Architecture

A business often requires multi-level reasons for tracking interactions. The architecture provides an **arbitrary depth tree**:

### 7.1 Tree Structure Example
```text
All Dispositions
│
├── Contactable
│   ├── Interested
│   │   ├── High Budget (Terminal, setsStatus: "Qualified")
│   │   ├── Needs Demo (Terminal, requiresFollowUp: true)
│   │   └── Ready to Buy (Terminal, triggersConversion: true)
│   └── Not Interested
│       ├── Price Issue
│       │   ├── Too Expensive (Terminal, closesEnquiry: true)
│       │   └── Waiting for Discount (Terminal, requiresFollowUp: true)
│       ├── Bought from Competitor (Terminal, closesEnquiry: true)
│       └── Product Mismatch (Terminal, closesEnquiry: true)
│
└── Non-Contactable
    ├── Busy / Driving (Terminal, requiresFollowUp: true, followUpMandatory: true)
    ├── Switched Off (Terminal, requiresFollowUp: true)
    ├── Call Disconnected (Terminal, requiresFollowUp: true)
    └── Wrong Number (Terminal, closesEnquiry: true)
```

### 7.2 Rule Enforcement Matrix
Each terminal disposition node holds a `DispositionRule` record evaluated on interaction submission:
- `requiresFollowUp`: Form renders the Follow-up scheduling section.
- `followUpMandatory`: API returns `400 VALIDATION_ERROR` if `dueAt` is missing.
- `allowsClose`: If `false`, rejects requests attempting to set terminal status (`CLOSED`/`LOST`).
- `closesEnquiry`: Server automatically updates enquiry `deletedAt: null, statusId: closedStatusId`.
- `triggersConversion`: Server returns directive to present Conversion dialog.

### 7.3 Follow-Up Lifecycle Architecture (Strictly Reusing Task System)

Follow-ups **MUST strictly reuse the existing Task system** (`model Task`). A separate follow-up or task architecture is strictly prohibited to prevent fragmented calendars, duplicated reminders, and broken operational workflows.

However, a follow-up is not a one-time static event. The system enforces a complete, auditable follow-up lifecycle:

```text
       ┌───────────────┐
       │    PENDING    │◀──────────────────┐
       └───────┬───────┘                   │
               │                           │
       ┌───────┼────────────────┐          │
       │       │                │          │
       ▼       ▼                ▼          │
 ┌──────────┐ ┌───────────┐ ┌─────────┐    │
 │COMPLETED │ │RESCHEDULED│ │OVERDUE  │    │
 └──────────┘ └─────┬─────┘ └────┬────┘    │
                    │            │         │
                    └────────────┴─────────┘
                                 │
                            (Updated Due Date)
                                 │
                                 └─► Re-enters active follow-up state
                                     with immutable history preserved

 ┌───────────┐
 │ CANCELLED │ (Triggered explicitly or via "Do Not Contact" disposition)
 └───────────┘
```

#### 7.3.1 Cardinal Invariant: At Most One Active Follow-Up Task
- **Single Active Task**: An active enquiry must have at most **ONE** active follow-up Task for the relevant follow-up workflow, unless an explicit workflow extension dictates concurrent tasks.
- **Rescheduling on Customer Request**:
  - Example: Customer says "Call me tomorrow" (Disposition: `CALL_BACK_REQUESTED`).
  - The agent selects the next date/time.
  - The existing active follow-up Task is updated with the new date/time and marked `RESCHEDULED` rather than creating redundant, duplicate tasks.
- **Handling Non-Contact / No Answer**:
  - Disposition: `NO_ANSWER`.
  - The agent schedules/reschedules the next follow-up.
  - **`NO_ANSWER` must NOT automatically create unlimited orphan tasks.** The existing active follow-up is updated/rescheduled.

#### 7.3.2 Immutable Follow-Up History & Audit Trail
Historical follow-up events must **never** be overwritten. Every reschedule, completion, cancellation, or overdue transition writes an immutable audit record to `TaskRescheduleHistory`:
- `previousDueAt`: Previous scheduled date/time
- `newDueAt`: New scheduled date/time (null if completed/cancelled)
- `action`: Action/outcome (`RESCHEDULED`, `COMPLETED`, `CANCELLED`, `OVERDUE`)
- `dispositionId`: Linked disposition (e.g., `CALL_BACK_REQUESTED`, `NO_ANSWER`)
- `reason`: Reason / remarks where provided
- `userId`: User who performed the action
- `createdAt`: Immutable timestamp

**Example Follow-up Lifecycle on Task #456:**
```text
Task #456
├── Initial:       18 Sep 11:00 (Created with Enquiry)
├── Rescheduled:   19 Sep 11:00 | Reason: "Customer requested callback" | User: Rep A
├── Rescheduled:   20 Sep 15:00 | Reason: "Customer unavailable / No Answer" | User: Rep A
└── Completed:     20 Sep 15:10 | Outcome: "Customer contacted, requirements gathered" | User: Rep A
```
*The current `Task` represents the current active follow-up state. The history represents everything that happened to that follow-up.*

#### 7.3.3 Overdue Follow-Up Management
- If a follow-up passes its `dueAt` date without completion, it transitions to `OVERDUE`.
- The system allows authorized users to:
  - **Complete** the overdue task with outcome remarks.
  - **Reschedule** the task to a future date/time with a stated reason.
  - **Cancel** the task if no longer actionable.

#### 7.3.4 Disposition Coupling Rules
- **"Do Not Contact" / Closed Lost**: If a selected disposition indicates "Do Not Contact", any active follow-up associated with that enquiry must be automatically cancelled according to server-side business rules.
- **Mandatory Follow-Up Requirement**: If a disposition requires a follow-up (`followUpMandatory = true`), the enquiry cannot be completed or closed until the required follow-up has been successfully scheduled.

#### 7.3.5 Server-Side Security, RBAC & Data Scope
Every follow-up action must strictly respect:
- **Tenant Isolation**: `companyId` strictly scoped to caller tenant context.
- **RBAC**: Enforces `tasks.create` and `tasks.update` permissions.
- **Data Scope**: Enforces `OWN`, `TEAM`, `COMPANY` ownership rules.
- **Assignment Permissions**: Tasks can only be assigned to active members within authorized scope.
- **Zero Client Trust**: Client-side changes must never bypass these rules; all validations execute server-side.

---

## 8. Dynamic Form Architecture (Extending CustomField Engine)

The existing `CustomField` model in Slice 5 already supports `entityType: String`. We extend its scope:

```text
Entity Types Supported:
├── "CUSTOMER"   (e.g. Tax ID, Birthday, VIP Tier, Industry, Organization Size)
├── "ENQUIRY"    (e.g. Budget, Move-in Date, Patient Symptoms, Course Shift, Financing Needed)
└── "OFFERING"   (e.g. Warranty Period, Doctor Department, Screen Size, Batch Timing)
```

### Server-Side Validation Pipeline
1. Client submits custom field values: `{ customFieldValues: { "budget_range": "50k-100k", "preferred_intake": "Fall 2026" } }`.
2. Server queries active custom fields for `(companyId, entityType)` in a single batched read.
3. Server validates:
   - **Required Fields**: Throws error if a required field is missing or empty.
   - **Type Enforcement**: Ensures `NUMBER` is numeric, `DATE` parses valid ISO, `BOOLEAN` is boolean.
   - **Option Constraints**: For `SELECT` and `MULTI_SELECT`, verifies value exists within `options` JSON.
   - **Tenant Security**: Discards any key not matching tenant's active configuration.

---

## 9. Product / Service / Offering Architecture

Universal CRM avoids hardcoded product schemas by using the `Offering` and `OfferingCategory` models.

### Universal Industry Mapping

| Industry | Offering Type | Category Example | Offering Example | Sample Dynamic Attributes |
|---|---|---|---|---|
| **Electronics Retail** | `PRODUCT` | Televisions | OLED 65" 4K | `{ brand: "LG", panel: "OLED", warrantyMonths: 36 }` |
| **Healthcare** | `SERVICE` | Outpatient | Cardiology Consult | `{ doctor: "Dr. Rao", department: "Cardio", durationMin: 30 }` |
| **Higher Education** | `PROGRAM` | Executive Programs | Data Science Diploma | `{ credits: 30, instructor: "Prof. Smith", term: "Fall" }` |
| **Real Estate** | `PRODUCT` | Residential | 3BHK Luxury Suite | `{ carpetAreaSqft: 1850, floor: 14, facing: "East" }` |
| **Digital Agency** | `SERVICE` | Marketing | Enterprise SEO Package| `{ deliverables: ["Audit", "Backlinks"], billing: "Monthly" }` |

---

## 10. Conversion Architecture

When an enquiry reaches a successful outcome, the transaction is formalized in `Conversion`:
- **Attributes Preserved**:
  - `enquiryId`: Links to the converted `Lead`.
  - `customerId`: Links to the customer identity for Lifetime Value (LTV) calculation.
  - `offeringId`: Specifies the exact product, service, or plan purchased.
  - `convertedById`: Identifies the closing sales agent for commission/performance tracking.
  - `amount`: The closed revenue value (`Decimal(15, 2)`).
  - `metadata`: Flexible JSON storing invoice numbers, policy codes, or contract URLs.
- **Enquiry State**: Status transitions to `Converted` (won). The enquiry remains in the database as a completed sales record.

---

## 11. Dashboard & Server-Side Clickable Drill-Down Architecture

```text
[Dashboard Metric Card]
"Delhi Enquiries: 1,250"
         │
         ▼ (User Clicks "Delhi")
Client Navigates To:
/app/leads?city=Delhi&source=dashboard_widget
         │
         ▼ (Server-Side Route Handler)
GET /api/v1/leads?city=Delhi
         │
         ▼
[Server-Side Query Construction in LeadService]
where: {
  companyId: ctx.company.id,               // 1. Mandatory Tenant Boundary
  deletedAt: null,                          // 2. Active Records Only
  ...buildScopeFilter(ctx),                // 3. Mandatory RBAC Scope (OWN / TEAM / COMPANY)
  customFieldValues: {                     // 4. Filter on City Custom Field
    some: {
      customField: { key: "city" },
      value: "Delhi"
    }
  }
}
         │
         ▼
Return ONLY authorized, paginated records.
(Agent A only sees their 40 Delhi leads; Manager sees team's 300; Admin sees all 1,250)
```

### Critical Security Rule for Drill-Downs
- **NEVER trust pre-calculated IDs or client-side filter payloads.**
- Every drill-down request passes filter keys (e.g. `dispositionCode=BUSY`, `city=Delhi`) to the API.
- The API re-evaluates the query through the server-side identity context (`AuthContext`), guaranteeing zero data leakage across agents, teams, or tenants.

---

## 12. Complete API Specification (Future V1.2 Blueprint)

### 12.1 Customer Identity Endpoints
- `GET /api/v1/customers` — List customers with pagination, search, and sorting (`customers.view`).
- `POST /api/v1/customers` — Create customer with primary phone and email (`customers.create`).
- `GET /api/v1/customers/:id` — Get customer profile with authorized timeline (`customers.view`).
- `PATCH /api/v1/customers/:id` — Update customer profile details (`customers.update`).
- `DELETE /api/v1/customers/:id` — Soft-delete customer (`customers.delete`).
- `GET /api/v1/customers/resolve?phone=` — Fast indexed customer resolution by normalized phone.

### 12.2 Customer Phones & Emails
- `POST /api/v1/customers/:id/phones` — Add secondary phone number (`customers.update`).
- `DELETE /api/v1/customers/:id/phones/:phoneId` — Remove secondary phone number (`customers.update`).
- `POST /api/v1/customers/:id/emails` — Add secondary email address (`customers.update`).
- `DELETE /api/v1/customers/:id/emails/:emailId` — Remove secondary email (`customers.update`).

### 12.3 Customer Merge Operations
- `POST /api/v1/customers/:id/merge` — Merge source customer into destination (`customers.manage`).

### 12.4 Enquiries (Extending Existing `/api/v1/leads`)
- `GET /api/v1/leads` — Extended with `customerId`, `offeringId`, and `dispositionId` filters.
- `POST /api/v1/leads` — Extended to accept `customerId` (linking to existing customer) or customer creation payload.
- `GET /api/v1/customers/:id/enquiries` — Returns all enquiries belonging to this customer that the current user is authorized to view.

### 12.5 Offerings & Categories
- `GET /api/v1/offerings` — List catalog offerings (`offerings.view`).
- `POST /api/v1/offerings` — Create offering (`offerings.manage`).
- `PATCH /api/v1/offerings/:id` — Update offering (`offerings.manage`).
- `DELETE /api/v1/offerings/:id` — Archive offering (`offerings.manage`).

### 12.6 Hierarchical Dispositions
- `GET /api/v1/dispositions` — Retrieve full hierarchical disposition tree (`dispositions.view`).
- `POST /api/v1/dispositions` — Create disposition node with rules (`dispositions.manage`).
- `PATCH /api/v1/dispositions/:id` — Update disposition node or rule (`dispositions.manage`).
- `DELETE /api/v1/dispositions/:id` — Remove disposition node (`dispositions.manage`).

---

## 13. Security Threat Model & Defense Matrix

| Threat / Attack Vector | Risk Level | Architectural Defense Mechanism |
|---|:---:|---|
| **Cross-Tenant Customer Access (IDOR)** | CRITICAL | Every customer query enforces `where: { companyId: ctx.company.id, id: targetId }`. Foreign IDs return HTTP 404. |
| **Phone Search Enumeration** | HIGH | `GET /api/v1/customers/resolve?phone=` searches ONLY within `ctx.company.id`. Cross-tenant matches are strictly invisible. |
| **Data Scope Bypass via Customer History** | CRITICAL | Querying `/api/v1/customers/:id/enquiries` enforces `buildScopeFilter(ctx)`. Reps only see their assigned enquiries for that customer. |
| **Cross-Tenant Customer Merge** | CRITICAL | `CustomerMergeService` validates that both `sourceCustomer.companyId` and `destCustomer.companyId` match `ctx.company.id`. |
| **Forged Offering / Disposition IDs** | HIGH | Schema validation checks that `offering.companyId == ctx.company.id` and `disposition.companyId == ctx.company.id` before linking. |
| **Client-Side Drill-Down Tampering** | MEDIUM | Dashboard drill-down routes re-filter dynamically on the server; client cannot inject raw SQL or bypass soft-delete/RBAC gates. |

---

## 14. Performance & Scalability (20k–30k Users, Millions of Enquiries)

### 14.1 Indexing Strategy
1. **Phone Lookup**: Composite unique index `@@unique([companyId, normalizedPhone])` on `customer_phones`. Phone resolution executes in $< 2\text{ms}$ using B-tree index scan.
2. **Customer Enquiry History**: Composite index `@@index([companyId, customerId, createdAt(sort: Desc)])` on `leads` table. Customer timeline loads in $< 10\text{ms}$ without scanning unrelated leads.
3. **Enquiry Scope Queries**: Composite indexes `@@index([companyId, assignedUserId, createdAt(sort: Desc)])` and `@@index([companyId, teamId, createdAt(sort: Desc)])`.

### 14.2 N+1 Prevention
- Customer resolution uses Prisma `findUnique` with `include: { customer: true }`.
- Customer profile fetches enquiries using a single paginated query with `take: 20`.
- Timeline activity queries use batched `findMany` matching `leadId: { in: visibleEnquiryIds }`.

---

## 15. Migration Plan from Current Lead Model (Zero Downtime)

```text
[Phase 1: Additive Schema Migration]
Add Customer, CustomerPhone, CustomerEmail, Offering, Disposition models.
Add nullable `customerId` and `offeringId` columns to existing `leads` table.
(Zero breaking changes: existing application continues reading/writing `leads` without disruption)
                          │
                          ▼
[Phase 2: Offline Deterministic Backfill Script]
1. Read existing leads in chunks of 500.
2. For each lead with a valid phone:
   - Normalize phone to E.164.
   - Upsert Customer and CustomerPhone for that (companyId, normalizedPhone).
   - Set lead.customerId = customer.id.
3. For leads without phone:
   - Create distinct Customer record using lead name/email.
   - Set lead.customerId = customer.id.
4. Output duplicate report showing customers that merged multiple existing leads.
                          │
                          ▼
[Phase 3: Verification & Integrity Audit]
Validate 100% of non-deleted leads have valid `customerId`.
Verify no foreign tenant links exist.
                          │
                          ▼
[Phase 4: Code Cutover]
Deploy new Create Enquiry UI (resolves customer before creating lead).
Activate Customer Profile workspaces.
```

---

## 16. Phased Implementation Roadmap

```text
PHASE 1:  Customer Identity Schema (Customer, CustomerPhone, CustomerEmail models) [COMPLETE]
PHASE 2:  Phone Normalizer & Fast Customer Resolution Service [COMPLETE]
PHASE 3:  Lead Model Extension & Compatibility Layer (Add customerId FK to leads table) [COMPLETE]
PHASE 4A: Historical Customer Backfill Dry Run (Conflict Safety & Zero DB Mutation) [COMPLETE]
PHASE 4B: Historical Customer Backfill Execution (100 Leads Linked, 16 Preserved Unresolved) [COMPLETE]
PHASE 5:  Customer CRUD APIs, Contact Management & Data-Scope Enforced Profile [COMPLETE]
PHASE 6:  Offerings Catalog & Primary "Create Enquiry" Guided Workflow with Price Override [COMPLETE]
PHASE 7:  Hierarchical Dispositions, Follow-Up Lifecycle & Conversion Engine [NEXT - AUTHORIZATION REQUIRED]
          • Hierarchical Disposition Tree Schema & APIs (Category → Sub-disposition)
          • Follow-Up Lifecycle Engine (Strict reuse of Task model: PENDING → COMPLETED → RESCHEDULED → CANCELLED → OVERDUE)
          • Single Active Follow-Up Task Invariant per Enquiry
          • Reschedule Mechanics (CALL_BACK_REQUESTED, NO_ANSWER) without duplicate task explosion
          • Immutable Follow-Up Audit Trail (TaskRescheduleHistory)
          • Overdue Follow-Up Management & Actions (Complete, Reschedule, Cancel)
          • Disposition Coupling (Do Not Contact cancels active follow-ups; Mandatory follow-up gates enquiry)
          • Conversion Engine (Enquiry Conversion, Revenue Logging & Customer Status Advancement)
PHASE 8:  Customer Merge, Link & Unlink Operations
PHASE 9:  Dynamic Enquiry Forms (Extending CustomField for Offerings & Enquiries)
PHASE 10: Configurable Dashboard Widgets & Server-Side Clickable Drill-Downs
PHASE 11: CSV Import/Export Multi-Entity Refactoring (Customer + Enquiry)
PHASE 12: Customer Analytics & Lifetime Value Reporting
PHASE 13: Security Hardening & High-Volume Performance Profiling
PHASE 14: Documentation & In-App Help Center Guides
```

---

## 17. What Must NOT Be Changed

To preserve the production stability of Slices 1–8:
1. **DO NOT change `AuthContext`**: Server-side tenant identity resolution must remain untouched.
2. **DO NOT drop or rename the `leads` table**: Existing APIs, tasks, and activities depend on `leads.id`.
3. **DO NOT modify `universal_crm_session` or `universal_crm_superadmin_session` cookie architecture**.
4. **DO NOT replace the `Task` model**: Follow-ups must continue using `tasks` to avoid splitting the notification and operational calendar.
5. **DO NOT bypass Data Scope**: Customer identity must never be used as a backdoor to leak lead details across sales reps.
