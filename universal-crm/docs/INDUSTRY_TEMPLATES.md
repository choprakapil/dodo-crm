# Universal CRM — Industry Template System (Phase B.3)

## 1. Architectural Overview & Core Principles

The Industry Template system in Universal CRM provides optional, configuration-driven blueprints for new tenants to accelerate workspace setup tailored to their sector (e.g. General Sales, Real Estate, Healthcare, Education).

### Critical Principle: Configuration, Not Business Logic

Industry templates are **declarative configuration**, NOT CRM business logic branches.
Core CRM domain services remain completely industry-neutral.
There are **strictly NO branches** in domain services such as:
```typescript
// PROHIBITED IN UNIVERSAL CRM
if (industry === "healthcare") { ... }
if (industry === "real_estate") { ... }
```

Instead, templates define generic CRM configuration records that the standard CRM engine already executes:
- Custom fields (`CustomField` for `LEAD` and `CUSTOMER`)
- Lead/Enquiry dispositions (`Disposition` with lifecycle tags, follow-up flags, and conversion rules)
- Acquisition sources (`LeadSource`)
- Sales pipeline stages (`LeadStatus`)
- Catalog items (`Offering`)
- History preview field selections (`historyPreviewFields`)

---

## 2. Blueprint vs. Tenant Configuration Ownership

| Component | Nature | Storage | Ownership & Mutation Lifecycle |
|---|---|---|---|
| **System Template** | Blueprint | Code-defined TypeScript objects in `lib/templates/definitions/` | Platform-owned, immutable, versioned (`key@version`). Modifying code creates a new version; it never retroactively alters existing tenant databases. |
| **Tenant Configuration** | Database Rows | PostgreSQL rows in tenant's schema (`custom_fields`, `dispositions`, `lead_sources`, etc.) | Tenant-owned. The tenant's administrators can edit, rename, deactivate, or delete any applied fields or dispositions at any time. |

Applying a template copies the blueprint into tenant-owned records. Tenants are **never dynamically dependent** on mutable global database template rows.

---

## 3. Architecture Decision: Code-Defined Blueprints vs Database Tables

We evaluated three architectural patterns:
1. **Option A: Pure Code-Defined Versioned Blueprints (Selected)**
2. **Option B: Database-Backed System Template Tables**
3. **Option C: Hybrid (Database-cached code definitions)**

### Decision: Option A (Code-Defined Versioned Blueprints)
- **Zero Cross-Tenant Shared Mutable State**: Global database template rows risk accidental cross-tenant mutation, shared lock contention, or cascading schema drift when platform admins edit templates.
- **Git-Tracked Auditability & CI/CD Safety**: Blueprints undergo pull-request review, automated linting, type-checking, and regression testing alongside the codebase.
- **Deterministic Versioning**: Every blueprint has an explicit key and version (`general-sales@1`, `real-estate@1`).
- **Simplicity**: No complex global-to-tenant synchronization machinery or sync drift.

The only database schema change introduced was lightweight tracking on `Company`:
- `appliedTemplateKey String?`
- `appliedTemplateVersion Int?`
- `appliedTemplateAt DateTime?`

---

## 4. Application Semantics, Tracking & One Template Per Company Contract

Template application executes inside a single atomic database transaction (`prisma.$transaction`).

### One Template Per Company Product Contract
Universal CRM enforces an explicit **One Template Per Company** product model:
- **First Application (`template.applied`)**: Succeeds and applies the blueprint's entities.
- **Re-application of Same Template (`template.reapplied`)**: Strictly idempotent (creates 0 duplicates, preserves existing tenant modifications).
- **Template Version Upgrade (`template.upgraded`)**: Applies new items introduced in higher version of the active template.
- **Switching Template (`template.switched`)**: If a company with `appliedTemplateKey = "real-estate"` attempts to apply `"general-sales"`, the system **fails closed** with a `ValidationError` unless the administrative user provides explicit confirmation (`forceSwitch: true`).
- **Additive Preservation Guarantee**: Switching templates never deletes, overwrites, or destroys pre-existing custom fields, dispositions, sources, or offerings. New items are additively merged.

### Pipeline Execution:
1. **Authentication & RBAC**: Resolves `AuthContext` from verified session/cookie. Enforces `settings:manage` or `Admin` role. Client-supplied `companyId` in query/body is rejected.
2. **Catalog Lookup**: Fetches blueprint by `key` and `version` from `TemplateRegistry`.
3. **Template Switch Guard**: Verifies whether `company.appliedTemplateKey` differs from target. Blocks without `forceSwitch: true`.
4. **Currency Safety Validation**: Verifies tenant has configured currency (`company.currency`). If template defines offerings and tenant has no currency configured, fails closed with `ValidationError` and `OFFERING_CURRENCY` conflict in preview.
5. **Dry-Run Analysis**: Compares blueprint items against existing tenant database rows:
   - Identical key/code + matching type: `SKIP_MATCH` (reused; zero duplicate rows).
   - Incompatible type collision: `CONFLICT` (detected; halts execution before mutation).
   - Novel item: `CREATE`.
6. **Validation Gate**: If any `CONFLICT` exists, transaction throws `ValidationError` and cancels mutation. Existing tenant data remains 100% untouched.
7. **Atomic Creation**: Inserts all `CREATE` items scoped strictly to `ctx.company.id`. Offerings inherit tenant's explicit currency.
8. **Company Stamping**: Records `appliedTemplateKey`, `appliedTemplateVersion`, and `appliedTemplateAt`.
9. **Audit Logging**: Inserts an `audit_logs` record with action (`template.applied`, `template.reapplied`, `template.upgraded`, `template.switched`), recording previous template key, current key, and created/skipped counts.

---

## 5. Currency Safety Architecture

### Decision: Option A — Currency-Independent Catalog Metadata
Universal CRM strictly prohibits implicit currency conversions or hardcoded dollar assumptions in industry templates.
1. **Catalog Metadata Only**: Template offerings define catalog metadata (name, code, type, description, and initial `price: 0`). Templates do not define currency-specific dollar amounts.
2. **Explicit Currency Resolution Hierarchy**:
   ```
   Offering currency (explicit) -> Company currency (tenant setting) -> REJECT / FAIL CLOSED
   ```
3. **Zero Implicit USD Fallback**: Neither `OfferingService` nor `TemplateService` defaults to `"USD"` or `"INR"`. If a tenant attempts to create or apply offerings without a configured currency, the operation fails closed with `ValidationError`.
4. **Deterministic Multi-Currency Support**:
   - Tenant with currency `INR` -> applied offerings strictly inherit `currency: "INR"`.
   - Tenant with currency `EUR` -> applied offerings strictly inherit `currency: "EUR"`.
   - Tenant with currency unset -> preview reports `OFFERING_CURRENCY` conflict; application rejected.

---

## 6. Initial Registered Templates

### 1. General Sales (`general-sales@1`)
- **Use Case**: B2B / B2C sales and commerce organizations.
- **Custom Fields**:
  - `deal_value` (NUMBER), `lead_priority` (SELECT: Low, Medium, High, Urgent), `expected_close_date` (DATE)
  - Customer: `industry_segment` (SELECT), `tax_id` (TEXT)
- **Dispositions**:
  - `GEN_FOLLOWUP`, `GEN_MEETING`, `GEN_PROPOSAL`, `GEN_NOT_INTERESTED`
- **Lead Sources**:
  - Organic Search, Inbound Phone, LinkedIn, Customer Referral
- **Offerings (Catalog Metadata, Price: 0)**:
  - Professional Consultation Package (`CONSULT-PRO`, SERVICE)
  - Enterprise Annual Subscription (`SUB-ENT-YR`, SERVICE)

### 2. Real Estate (`real-estate@1`)
- **Use Case**: Property brokerage, developments, and leasing.
- **Custom Fields**:
  - `property_type` (SELECT), `budget_min` (NUMBER), `budget_max` (NUMBER), `preferred_location` (TEXT), `possession_timeline` (SELECT)
  - Customer: `investor_type` (SELECT), `current_city` (TEXT)
- **Dispositions**:
  - `RE_SITE_VISIT` (mandatory follow-up), `RE_VISIT_DONE`, `RE_NEGOTIATION`, `RE_BOOKED`, `RE_LOCATION_MISMATCH`, `RE_BUDGET_MISMATCH`
- **Lead Sources**:
  - Property Portal, Site Walk-in, Channel Partner / Broker, Newspaper Advertisement, Outdoor Hoarding
- **Offerings (Catalog Metadata, Price: 0)**:
  - 2 BHK Luxury Apartment (`UNIT-2BHK`, PRODUCT)
  - 3 BHK Premium Villa (`UNIT-3BHK-VILLA`, PRODUCT)
  - High Street Retail Unit (`RETAIL-G01`, PRODUCT)

### 3. Healthcare (`healthcare@1`)
- **Use Case**: Clinics, outpatient services, diagnostic centers, wellness clinics.
- **Custom Fields**:
  - `consultation_specialty` (SELECT), `preferred_doctor` (TEXT), `preferred_appointment_date` (DATE), `consultation_mode` (SELECT)
  - Customer: `blood_group` (SELECT), `emergency_contact_phone` (PHONE)
- **Dispositions**:
  - `HC_CONSULT_SCHEDULED`, `HC_TREATMENT_PLAN`, `HC_LAB_RECOMMENDED`, `HC_NO_SHOW`, `HC_DISCHARGED`
- **Lead Sources**:
  - Clinic Walk-in, Doctor Referral, Medical Directory, Health Camp, Emergency Helpline
- **Offerings (Catalog Metadata, Price: 0)**:
  - Specialist Initial Consultation (`MED-CONSULT`, SERVICE)
  - Full Body Preventive Health Checkup (`MED-CHECKUP-FULL`, SERVICE)
  - 7-Day Wellness Rejuvenation Therapy (`WELLNESS-7D`, SERVICE)

### 4. Education (`education@1`)
- **Use Case**: Universities, training academies, EdTech institutes.
- **Custom Fields**:
  - `program_interested` (SELECT), `highest_qualification` (SELECT), `target_intake` (SELECT), `scholarship_requested` (BOOLEAN)
  - Customer: `guardian_name` (TEXT), `guardian_phone` (PHONE)
- **Dispositions**:
  - `EDU_COUNSEL_SCHEDULED`, `EDU_DEMO_ATTENDED`, `EDU_APP_SUBMITTED`, `EDU_ENROLLED`, `EDU_FEE_ISSUE`, `EDU_JOINED_COMPETITOR`
- **Lead Sources**:
  - Campus Seminar, Education Fair, Website Application, Alumni Referral, Social Media Ad
- **Offerings (Catalog Metadata, Price: 0)**:
  - Full Stack Engineering Immersion (`COURSE-FS-6M`, SERVICE)
  - Executive AI & Machine Learning Track (`COURSE-AI-EXEC`, SERVICE)
  - Foundational Tech Certification (`CERT-TECH-BASE`, PRODUCT)

---

## 7. Developer Guide: Adding a New Industry Template

To add a new industry template (e.g. `logistics@1` or `automotive@1`), follow these 3 steps:

### Step 1: Create Definition File
Create `lib/templates/definitions/<key>.ts`:
```typescript
import { IndustryTemplateDefinition } from "../types";
import { CustomFieldType } from "@prisma/client";

export const logisticsTemplate: IndustryTemplateDefinition = {
  metadata: {
    key: "logistics",
    name: "Freight & Logistics",
    description: "Configures shipment origin/destination, fleet tracking, and transport dispositions.",
    version: 1,
    category: "Supply Chain",
    active: true,
  },
  configuration: {
    customFields: [
      {
        entityType: "LEAD",
        key: "cargo_type",
        label: "Cargo Type",
        fieldType: CustomFieldType.SELECT,
        options: ["Dry Goods", "Perishable / Cold Chain", "Hazardous Material", "Automotive Parts"],
      },
      {
        entityType: "LEAD",
        key: "estimated_tonnage",
        label: "Estimated Tonnage (MT)",
        fieldType: CustomFieldType.NUMBER,
      },
    ],
    dispositions: [
      {
        name: "Quote Issued",
        code: "quote_issued",
        followUpMandatory: true,
        cancelActiveFollowUp: false,
      },
    ],
    leadSources: [{ name: "Freight Exchange" }, { name: "Direct Shipper" }],
    offerings: [
      {
        name: "Full Truckload Freight (Domestic)",
        code: "FTL_DOMESTIC",
        type: "SERVICE",
        price: 2500,
      },
    ],
  },
};
```

### Step 2: Register in `TemplateRegistry`
Add the import and registration in `lib/templates/registry.ts`:
```typescript
import { logisticsTemplate } from "./definitions/logistics";

// Inside registerDefaultTemplates():
this.register(logisticsTemplate);
```

### Step 3: Run Verification
Run the automated test suite:
```bash
npm test
npm run type-check
```

**Zero changes to core CRM routes, models, or business logic are required.**
