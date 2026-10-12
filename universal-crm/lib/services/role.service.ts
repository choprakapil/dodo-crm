/**
 * Role & Permission Management Service
 *
 * Implements role creation, permission assignment, privilege escalation guards,
 * system role protections, and audit logging.
 */

import { prisma } from "@/lib/db";
import { AuthContext } from "@/lib/auth/session";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { CreateRoleInput, UpdateRoleInput } from "@/lib/validations/role";
import { DataScope } from "@prisma/client";
import { QuotaService } from "./quota.service";

export interface PermissionExplanation {
  module: string;
  action: string;
  title: string;
  description: string;
  example: string;
  whenEnabled: string;
  whenDisabled: string;
  risk: "LOW" | "STANDARD" | "SENSITIVE" | "HIGH_RISK";
  applicableScopes: ("OWN" | "TEAM" | "COMPANY")[];
}

export interface RolePreset {
  id: string;
  name: string;
  description: string;
  permissions: {
    module: string;
    action: string;
    dataScope: "OWN" | "TEAM" | "COMPANY";
  }[];
}

export const PERMISSION_EXPLANATIONS: Record<string, PermissionExplanation> = {
  // Customers
  "customers.view": {
    module: "customers",
    action: "view",
    title: "View Customers",
    description: "Allows reading customer profile records, phone numbers, and communication history.",
    example: "Looking up an existing customer's contact record to review previous interactions.",
    whenEnabled: "User can see customer details within their permitted data scope (Own, Team, or Company).",
    whenDisabled: "Customer directory and customer detail views return 403 Forbidden.",
    risk: "LOW",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "customers.create": {
    module: "customers",
    action: "create",
    title: "Create Customers",
    description: "Allows creating new customer records manually or when qualifying enquiries.",
    example: "Adding a new corporate account directly into the CRM directory.",
    whenEnabled: "User can save new customers with primary phone, email, and company details.",
    whenDisabled: "Cannot create customer records; customer creation forms and APIs are blocked.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "customers.update": {
    module: "customers",
    action: "update",
    title: "Update Customers",
    description: "Allows editing existing customer profile fields, addresses, and phone numbers.",
    example: "Updating a customer's secondary phone number or billing contact details.",
    whenEnabled: "User can edit and save changes to permitted customer profiles.",
    whenDisabled: "Customer profile fields become read-only; update mutations are rejected.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "customers.delete": {
    module: "customers",
    action: "delete",
    title: "Delete / Archive Customers",
    description: "Allows soft-deleting customer records from the active workspace directory.",
    example: "Removing a duplicate or erroneous customer profile.",
    whenEnabled: "User can soft-delete customer records (retaining linked history for safety).",
    whenDisabled: "Delete button is hidden and backend blocks customer deletion.",
    risk: "SENSITIVE",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "customers.manage": {
    module: "customers",
    action: "manage",
    title: "Full Customer Administration",
    description: "Grants administrative authority over all customer records, deduplication, and linking.",
    example: "Reassigning customer ownership and linking orphan enquiries.",
    whenEnabled: "User has unrestricted authority across customer lifecycle.",
    whenDisabled: "Administrative customer operations are denied.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },

  // Leads
  "leads.view": {
    module: "leads",
    action: "view",
    title: "View Leads & Enquiries",
    description: "Allows viewing lead records, status cards, and enquiry details.",
    example: "Viewing the list of assigned leads in the pipeline or table view.",
    whenEnabled: "User can access lead lists, Kanban board, and lead detail inspectors.",
    whenDisabled: "Lead views are completely inaccessible; returns 403 Forbidden.",
    risk: "LOW",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "leads.create": {
    module: "leads",
    action: "create",
    title: "Create Leads & Enquiries",
    description: "Allows logging new sales enquiries and capture forms.",
    example: "Entering a new inbound enquiry received via phone call or referral.",
    whenEnabled: "User can submit the 'New Lead' form and create enquiry records.",
    whenDisabled: "New Lead button is hidden; lead creation API rejects requests.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "leads.update": {
    module: "leads",
    action: "update",
    title: "Update Leads",
    description: "Allows modifying lead properties, advancing pipeline stage, and editing notes.",
    example: "Moving a lead from 'Contacted' to 'Proposal Sent' and updating deal value.",
    whenEnabled: "User can edit lead status, priority, offering, and custom field values.",
    whenDisabled: "Lead detail is read-only; drag-and-drop Kanban updates are prevented.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "leads.delete": {
    module: "leads",
    action: "delete",
    title: "Delete Leads",
    description: "Allows soft-deleting lead records from the active CRM database.",
    example: "Removing an erroneous or spam test lead from the pipeline.",
    whenEnabled: "User can archive / soft-delete lead records.",
    whenDisabled: "Delete actions are forbidden; lead records cannot be deleted.",
    risk: "SENSITIVE",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "leads.assign": {
    module: "leads",
    action: "assign",
    title: "Assign & Reassign Leads",
    description: "Allows transferring lead ownership between team members or across teams.",
    example: "A sales manager distributing 50 inbound leads to telecallers.",
    whenEnabled: "User can reassign lead owners and teams; updates assignment history.",
    whenDisabled: "User cannot change lead owner; assignment dropdown is disabled.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "leads.export": {
    module: "leads",
    action: "export",
    title: "Export Leads to CSV",
    description: "Allows downloading customer contact details and lead records to CSV spreadsheets.",
    example: "Downloading a CSV list of leads for offline analysis or marketing reporting.",
    whenEnabled: "Export button is visible; CSV download API produces data.",
    whenDisabled: "Export actions are hidden and direct CSV export API calls are blocked with 403.",
    risk: "HIGH_RISK",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "leads.manage": {
    module: "leads",
    action: "manage",
    title: "Full Lead Administration",
    description: "Comprehensive administrative control over all workspace leads, stages, and ownership.",
    example: "Company admin overseeing all tenant leads without restriction.",
    whenEnabled: "User has full administrative power over lead operations.",
    whenDisabled: "Administrative lead overrides are restricted.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },

  // Offerings
  "offerings.view": {
    module: "offerings",
    action: "view",
    title: "View Products & Services Catalog",
    description: "Allows browsing company products, services, pricing, and active catalog items.",
    example: "A sales representative selecting an offering when creating a new lead quote.",
    whenEnabled: "User can browse offerings in settings and select offerings in lead forms.",
    whenDisabled: "Offering catalog is hidden and cannot be queried.",
    risk: "LOW",
    applicableScopes: ["COMPANY"],
  },
  "offerings.create": {
    module: "offerings",
    action: "create",
    title: "Create Catalog Offerings",
    description: "Allows adding new products or services to the company catalog.",
    example: "Adding a new consulting package or product SKU with base price.",
    whenEnabled: "User can create and publish new offerings to the catalog.",
    whenDisabled: "Create offering action is blocked.",
    risk: "STANDARD",
    applicableScopes: ["COMPANY"],
  },
  "offerings.update": {
    module: "offerings",
    action: "update",
    title: "Update Catalog Offerings",
    description: "Allows modifying offering names, descriptions, base prices, and active status.",
    example: "Updating standard retail pricing or deactivating a discontinued service.",
    whenEnabled: "User can edit catalog details.",
    whenDisabled: "Catalog modifications are rejected.",
    risk: "STANDARD",
    applicableScopes: ["COMPANY"],
  },
  "offerings.delete": {
    module: "offerings",
    action: "delete",
    title: "Delete / Archive Offerings",
    description: "Allows soft-deleting products or services from the active catalog.",
    example: "Archiving an old product line that is no longer offered.",
    whenEnabled: "User can archive offerings (historical leads retain their reference).",
    whenDisabled: "Catalog deletion is blocked.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },
  "offerings.manage": {
    module: "offerings",
    action: "manage",
    title: "Manage Catalog Settings",
    description: "Full administrative control over product/service catalog and pricing governance.",
    example: "Configuring company-wide price override rules.",
    whenEnabled: "User can configure catalog governance rules.",
    whenDisabled: "Administrative catalog settings are restricted.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },

  // Dispositions
  "dispositions.view": {
    module: "dispositions",
    action: "view",
    title: "View Call Dispositions",
    description: "Allows viewing outcome categories (e.g. Connected, Callback, Not Interested).",
    example: "A telecaller selecting an outcome from the Call Outcome modal.",
    whenEnabled: "User can view disposition options in call logs and modals.",
    whenDisabled: "Cannot view dispositions.",
    risk: "LOW",
    applicableScopes: ["COMPANY"],
  },
  "dispositions.create": {
    module: "dispositions",
    action: "create",
    title: "Create Call Dispositions",
    description: "Allows adding new call outcomes or sub-dispositions to the hierarchy.",
    example: "Adding 'Follow-up Requested: Technical Demo' to the disposition tree.",
    whenEnabled: "User can add new outcome categories in workspace settings.",
    whenDisabled: "Creation is blocked.",
    risk: "STANDARD",
    applicableScopes: ["COMPANY"],
  },
  "dispositions.update": {
    module: "dispositions",
    action: "update",
    title: "Update Call Dispositions",
    description: "Allows modifying outcome rules (e.g., requires follow-up, is terminal).",
    example: "Setting an outcome to strictly enforce mandatory follow-up task creation.",
    whenEnabled: "User can edit disposition names, colors, and operational rules.",
    whenDisabled: "Editing disposition configuration is blocked.",
    risk: "STANDARD",
    applicableScopes: ["COMPANY"],
  },
  "dispositions.delete": {
    module: "dispositions",
    action: "delete",
    title: "Delete Call Dispositions",
    description: "Allows archiving outcomes from the active call logging list.",
    example: "Removing an obsolete call disposition rule.",
    whenEnabled: "User can archive unused dispositions safely.",
    whenDisabled: "Deletion is blocked.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },
  "dispositions.manage": {
    module: "dispositions",
    action: "manage",
    title: "Manage Disposition Hierarchy",
    description: "Full administrative governance over multi-tier disposition trees and automations.",
    example: "Reordering and restructuring the multi-level outcome tree.",
    whenEnabled: "Full authority over disposition tree and rule governance.",
    whenDisabled: "Administrative configuration is restricted.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },

  // Activities & Tasks
  "activities.view": {
    module: "activities",
    action: "view",
    title: "View Activities & Notes",
    description: "Allows reading activity timelines, call logs, emails, WhatsApp messages, and notes.",
    example: "Reviewing previous call summaries on a lead's timeline.",
    whenEnabled: "User can read timeline activities within their data scope.",
    whenDisabled: "Activity timeline is inaccessible.",
    risk: "LOW",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "activities.create": {
    module: "activities",
    action: "create",
    title: "Log Activities & Notes",
    description: "Allows logging calls, notes, client meetings, and communications on leads.",
    example: "Writing a meeting note summarizing the client's budget and requirements.",
    whenEnabled: "User can log new activity records.",
    whenDisabled: "Activity logging is blocked.",
    risk: "LOW",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "activities.update": {
    module: "activities",
    action: "update",
    title: "Edit Activities & Notes",
    description: "Allows editing existing notes or activity descriptions.",
    example: "Correcting a typo or adding extra details to an earlier note.",
    whenEnabled: "User can update their permitted activity entries.",
    whenDisabled: "Activities are immutable once logged.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "activities.delete": {
    module: "activities",
    action: "delete",
    title: "Delete Activities & Notes",
    description: "Allows removing activity entries from the lead timeline.",
    example: "Removing an accidental duplicate note.",
    whenEnabled: "User can remove activity entries.",
    whenDisabled: "Timeline deletion is forbidden.",
    risk: "SENSITIVE",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "activities.manage": {
    module: "activities",
    action: "manage",
    title: "Manage Activity Rules",
    description: "Administrative authority over multi-channel activity tracking and logging.",
    example: "Admin managing workspace communication channels.",
    whenEnabled: "Full authority over activity management.",
    whenDisabled: "Restricted.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },

  "tasks.view": {
    module: "tasks",
    action: "view",
    title: "View Tasks & Follow-ups",
    description: "Allows viewing task rosters, pending follow-ups, and calendar schedules.",
    example: "Checking today's due follow-up calls in the Follow-ups workspace.",
    whenEnabled: "User can view assigned tasks and follow-up lists.",
    whenDisabled: "Follow-ups page is inaccessible.",
    risk: "LOW",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "tasks.create": {
    module: "tasks",
    action: "create",
    title: "Schedule Tasks & Follow-ups",
    description: "Allows scheduling upcoming follow-up calls, reminders, and team tasks.",
    example: "Scheduling a callback for next Tuesday at 3:00 PM.",
    whenEnabled: "User can create and schedule new follow-ups.",
    whenDisabled: "Follow-up scheduling is blocked.",
    risk: "LOW",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "tasks.update": {
    module: "tasks",
    action: "update",
    title: "Complete & Reschedule Follow-ups",
    description: "Allows marking tasks complete or rescheduling with lifecycle history.",
    example: "Marking a call complete or rescheduling when client was unavailable.",
    whenEnabled: "User can complete or reschedule tasks.",
    whenDisabled: "Task statuses cannot be modified.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "tasks.delete": {
    module: "tasks",
    action: "delete",
    title: "Cancel / Delete Tasks",
    description: "Allows cancelling or deleting pending tasks.",
    example: "Cancelling an obsolete reminder.",
    whenEnabled: "User can cancel tasks.",
    whenDisabled: "Task cancellation is blocked.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "tasks.manage": {
    module: "tasks",
    action: "manage",
    title: "Manage Task Rules",
    description: "Administrative authority over company-wide follow-up rules and overdue checks.",
    example: "Triggering workspace overdue task synchronization.",
    whenEnabled: "Full authority over task engine.",
    whenDisabled: "Restricted.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },

  // Reports
  "reports.view": {
    module: "reports",
    action: "view",
    title: "View Reports & Analytics",
    description: "Allows viewing KPI metrics, conversion funnel charts, and sales performance.",
    example: "Reviewing this month's lead conversion rates and team leaderboards.",
    whenEnabled: "User can access the Analytics Dashboard.",
    whenDisabled: "Analytics Dashboard is blocked; returns 403 Forbidden.",
    risk: "LOW",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "reports.export": {
    module: "reports",
    action: "export",
    title: "Export Analytics Data",
    description: "Allows exporting executive report summaries to CSV spreadsheets.",
    example: "Downloading monthly KPI reports for board presentations.",
    whenEnabled: "User can download analytics CSV data.",
    whenDisabled: "Export button is disabled; report export API is blocked.",
    risk: "STANDARD",
    applicableScopes: ["OWN", "TEAM", "COMPANY"],
  },
  "reports.manage": {
    module: "reports",
    action: "manage",
    title: "Manage Reporting Configuration",
    description: "Administrative control over reporting metrics, date ranges, and conversion goals.",
    example: "Configuring conversion targets and custom KPI definitions.",
    whenEnabled: "Full administrative reporting power.",
    whenDisabled: "Restricted.",
    risk: "STANDARD",
    applicableScopes: ["COMPANY"],
  },

  // Custom Fields
  "custom_fields.view": {
    module: "custom_fields",
    action: "view",
    title: "View Custom Field Definitions",
    description: "Allows inspecting custom field schema and available form fields.",
    example: "Viewing custom fields configured for real estate (e.g. Budget, Property Type).",
    whenEnabled: "User can view custom field list in settings.",
    whenDisabled: "Custom fields settings page is hidden.",
    risk: "LOW",
    applicableScopes: ["COMPANY"],
  },
  "custom_fields.manage": {
    module: "custom_fields",
    action: "manage",
    title: "Configure Custom Fields",
    description: "Allows creating, editing, reordering, and deleting dynamic custom fields.",
    example: "Adding a required 'Vehicle Registration Number' field with validation.",
    whenEnabled: "User can add, reorder, edit, and deactivate custom fields.",
    whenDisabled: "Custom field modifications are rejected with 403 Forbidden.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },

  // Users & Teams
  "users.view": {
    module: "users",
    action: "view",
    title: "View User Directory",
    description: "Allows viewing the roster of company users, assigned roles, and statuses.",
    example: "Checking employee email addresses and role assignments.",
    whenEnabled: "User can access the User Management workspace.",
    whenDisabled: "User Management workspace is inaccessible.",
    risk: "LOW",
    applicableScopes: ["COMPANY"],
  },
  "users.create": {
    module: "users",
    action: "create",
    title: "Invite & Add Users",
    description: "Allows creating employee accounts and issuing secure invitation links.",
    example: "Inviting a new sales representative to join the CRM workspace.",
    whenEnabled: "User can send invitations and generate invitation links.",
    whenDisabled: "Invite User button is hidden; invitation API rejects requests.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },
  "users.update": {
    module: "users",
    action: "update",
    title: "Edit User Profiles & Roles",
    description: "Allows editing user names, phone numbers, assigned roles, and team memberships.",
    example: "Promoting an employee from Junior Executive to Sales Manager.",
    whenEnabled: "User can edit employee profiles, change roles, and update teams.",
    whenDisabled: "Profile edits and role reassignment are blocked.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },
  "users.delete": {
    module: "users",
    action: "delete",
    title: "Deactivate & Remove Users",
    description: "Allows disabling user accounts, revoking workspace access, and offboarding.",
    example: "Disabling access for an employee who has departed the company.",
    whenEnabled: "User can disable user accounts and terminate active sessions.",
    whenDisabled: "User deactivation is forbidden.",
    risk: "HIGH_RISK",
    applicableScopes: ["COMPANY"],
  },
  "users.manage": {
    module: "users",
    action: "manage",
    title: "Full User Administration",
    description: "Unrestricted control over employee accounts, password resets, and session revocations.",
    example: "Triggering emergency password resets or session purges.",
    whenEnabled: "Full administrative authority over workspace users.",
    whenDisabled: "Restricted to authorized administrators only.",
    risk: "HIGH_RISK",
    applicableScopes: ["COMPANY"],
  },

  "teams.view": {
    module: "teams",
    action: "view",
    title: "View Teams & Hierarchy",
    description: "Allows viewing divisions, departments, teams, and member rosters.",
    example: "Viewing which team a sales executive reports to.",
    whenEnabled: "User can view organizational structure and team rosters.",
    whenDisabled: "Team management workspace is hidden.",
    risk: "LOW",
    applicableScopes: ["COMPANY"],
  },
  "teams.create": {
    module: "teams",
    action: "create",
    title: "Create Teams & Org Units",
    description: "Allows adding new teams, divisions, and departments.",
    example: "Creating a 'West Coast Outbound' team under the Sales Department.",
    whenEnabled: "User can create organizational units.",
    whenDisabled: "Creation is blocked.",
    risk: "STANDARD",
    applicableScopes: ["COMPANY"],
  },
  "teams.update": {
    module: "teams",
    action: "update",
    title: "Edit Teams & Membership",
    description: "Allows adding or removing members from teams and assigning team managers.",
    example: "Assigning Alice as the manager of the Enterprise Sales team.",
    whenEnabled: "User can modify team details, managers, and membership.",
    whenDisabled: "Modifications are blocked.",
    risk: "STANDARD",
    applicableScopes: ["COMPANY"],
  },
  "teams.delete": {
    module: "teams",
    action: "delete",
    title: "Delete / Archive Teams",
    description: "Allows deactivating teams and organizational units.",
    example: "Removing a dissolved project team safely.",
    whenEnabled: "User can delete empty teams.",
    whenDisabled: "Deletion is blocked.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },
  "teams.manage": {
    module: "teams",
    action: "manage",
    title: "Full Team Administration",
    description: "Administrative control over entire company organizational hierarchy.",
    example: "Restructuring company divisions and departmental reporting.",
    whenEnabled: "Full authority over organization hierarchy.",
    whenDisabled: "Restricted.",
    risk: "SENSITIVE",
    applicableScopes: ["COMPANY"],
  },

  // Roles
  "roles.view": {
    module: "roles",
    action: "view",
    title: "View Roles & Permissions",
    description: "Allows inspecting system and custom roles and their permission matrices.",
    example: "Reviewing what capabilities are assigned to the 'Telecaller' role.",
    whenEnabled: "User can view the Roles & Permissions workspace in Settings.",
    whenDisabled: "Roles page is inaccessible.",
    risk: "LOW",
    applicableScopes: ["COMPANY"],
  },
  "roles.manage": {
    module: "roles",
    action: "manage",
    title: "Manage Custom Roles",
    description: "Allows creating, editing, and deleting custom roles and assigning permissions.",
    example: "Creating a custom 'Accountant' role with read-only access to customer invoices.",
    whenEnabled: "User can design custom roles and configure granular permissions.",
    whenDisabled: "Role creation and edits are rejected with 403 Forbidden.",
    risk: "HIGH_RISK",
    applicableScopes: ["COMPANY"],
  },

  // Settings & Audit Logs
  "settings.view": {
    module: "settings",
    action: "view",
    title: "View Company Settings",
    description: "Allows viewing company legal name, timezone, currency, and business standards.",
    example: "Checking standard company operational timezone and currency code.",
    whenEnabled: "User can access Company Settings.",
    whenDisabled: "Settings pages are hidden.",
    risk: "LOW",
    applicableScopes: ["COMPANY"],
  },
  "settings.manage": {
    module: "settings",
    action: "manage",
    title: "Manage Company Settings",
    description: "Allows updating company profile, regional standards, and business rules.",
    example: "Updating company legal name or setting default country code.",
    whenEnabled: "User can edit and save company-wide settings.",
    whenDisabled: "Company settings modifications are blocked.",
    risk: "HIGH_RISK",
    applicableScopes: ["COMPANY"],
  },

  "audit_logs.view": {
    module: "audit_logs",
    action: "view",
    title: "View Audit Trail",
    description: "Allows inspecting immutable audit logs of security, user, and data events.",
    example: "Investigating who updated a customer profile or created a custom role.",
    whenEnabled: "User can inspect the workspace Audit Log timeline.",
    whenDisabled: "Audit log page is hidden and queries return 403 Forbidden.",
    risk: "STANDARD",
    applicableScopes: ["COMPANY"],
  },
};

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "sales-executive",
    name: "Sales Executive",
    description: "Frontline sales representative managing personal lead pipeline, scheduling follow-ups, and logging customer interactions.",
    permissions: [
      { module: "leads", action: "view", dataScope: "OWN" },
      { module: "leads", action: "create", dataScope: "OWN" },
      { module: "leads", action: "update", dataScope: "OWN" },
      { module: "customers", action: "view", dataScope: "OWN" },
      { module: "customers", action: "create", dataScope: "OWN" },
      { module: "customers", action: "update", dataScope: "OWN" },
      { module: "activities", action: "view", dataScope: "OWN" },
      { module: "activities", action: "create", dataScope: "OWN" },
      { module: "activities", action: "update", dataScope: "OWN" },
      { module: "tasks", action: "view", dataScope: "OWN" },
      { module: "tasks", action: "create", dataScope: "OWN" },
      { module: "tasks", action: "update", dataScope: "OWN" },
      { module: "offerings", action: "view", dataScope: "COMPANY" },
      { module: "dispositions", action: "view", dataScope: "COMPANY" },
    ],
  },
  {
    id: "telecaller",
    name: "Telecaller / BDR",
    description: "Outbound sales caller focused on dialing leads, recording call outcomes/dispositions, and booking follow-up meetings.",
    permissions: [
      { module: "leads", action: "view", dataScope: "OWN" },
      { module: "leads", action: "create", dataScope: "OWN" },
      { module: "leads", action: "update", dataScope: "OWN" },
      { module: "activities", action: "view", dataScope: "OWN" },
      { module: "activities", action: "create", dataScope: "OWN" },
      { module: "tasks", action: "view", dataScope: "OWN" },
      { module: "tasks", action: "create", dataScope: "OWN" },
      { module: "tasks", action: "update", dataScope: "OWN" },
      { module: "dispositions", action: "view", dataScope: "COMPANY" },
      { module: "offerings", action: "view", dataScope: "COMPANY" },
    ],
  },
  {
    id: "senior-sales-executive",
    name: "Senior Sales Executive",
    description: "Senior sales representative with broader team visibility, quoting authority, and lead progression control.",
    permissions: [
      { module: "leads", action: "view", dataScope: "TEAM" },
      { module: "leads", action: "create", dataScope: "TEAM" },
      { module: "leads", action: "update", dataScope: "TEAM" },
      { module: "customers", action: "view", dataScope: "TEAM" },
      { module: "customers", action: "create", dataScope: "TEAM" },
      { module: "customers", action: "update", dataScope: "TEAM" },
      { module: "activities", action: "view", dataScope: "TEAM" },
      { module: "activities", action: "create", dataScope: "TEAM" },
      { module: "activities", action: "update", dataScope: "TEAM" },
      { module: "tasks", action: "view", dataScope: "TEAM" },
      { module: "tasks", action: "create", dataScope: "TEAM" },
      { module: "tasks", action: "update", dataScope: "TEAM" },
      { module: "offerings", action: "view", dataScope: "COMPANY" },
      { module: "dispositions", action: "view", dataScope: "COMPANY" },
    ],
  },
  {
    id: "sales-manager",
    name: "Sales Manager",
    description: "Team leader with team-wide lead visibility, lead assignment/reassignment authority, analytics access, and export privileges.",
    permissions: [
      { module: "leads", action: "view", dataScope: "TEAM" },
      { module: "leads", action: "create", dataScope: "TEAM" },
      { module: "leads", action: "update", dataScope: "TEAM" },
      { module: "leads", action: "assign", dataScope: "TEAM" },
      { module: "leads", action: "export", dataScope: "TEAM" },
      { module: "customers", action: "view", dataScope: "TEAM" },
      { module: "customers", action: "create", dataScope: "TEAM" },
      { module: "customers", action: "update", dataScope: "TEAM" },
      { module: "activities", action: "view", dataScope: "TEAM" },
      { module: "activities", action: "create", dataScope: "TEAM" },
      { module: "activities", action: "update", dataScope: "TEAM" },
      { module: "tasks", action: "view", dataScope: "TEAM" },
      { module: "tasks", action: "create", dataScope: "TEAM" },
      { module: "tasks", action: "update", dataScope: "TEAM" },
      { module: "reports", action: "view", dataScope: "TEAM" },
      { module: "reports", action: "export", dataScope: "TEAM" },
      { module: "teams", action: "view", dataScope: "COMPANY" },
      { module: "users", action: "view", dataScope: "COMPANY" },
      { module: "offerings", action: "view", dataScope: "COMPANY" },
      { module: "dispositions", action: "view", dataScope: "COMPANY" },
    ],
  },
  {
    id: "customer-support-executive",
    name: "Customer Support Executive",
    description: "Support agent handling existing customer inquiries, updating communication logs, and resolving issues.",
    permissions: [
      { module: "customers", action: "view", dataScope: "COMPANY" },
      { module: "customers", action: "update", dataScope: "COMPANY" },
      { module: "leads", action: "view", dataScope: "COMPANY" },
      { module: "activities", action: "view", dataScope: "COMPANY" },
      { module: "activities", action: "create", dataScope: "COMPANY" },
      { module: "activities", action: "update", dataScope: "COMPANY" },
      { module: "tasks", action: "view", dataScope: "OWN" },
      { module: "tasks", action: "create", dataScope: "OWN" },
      { module: "tasks", action: "update", dataScope: "OWN" },
      { module: "dispositions", action: "view", dataScope: "COMPANY" },
      { module: "offerings", action: "view", dataScope: "COMPANY" },
    ],
  },
  {
    id: "quality-analyst",
    name: "Quality Analyst / Auditor",
    description: "Compliance officer reviewing customer communication logs, call outcomes, and audit trail without data alteration privileges.",
    permissions: [
      { module: "leads", action: "view", dataScope: "COMPANY" },
      { module: "customers", action: "view", dataScope: "COMPANY" },
      { module: "activities", action: "view", dataScope: "COMPANY" },
      { module: "tasks", action: "view", dataScope: "COMPANY" },
      { module: "audit_logs", action: "view", dataScope: "COMPANY" },
      { module: "reports", action: "view", dataScope: "COMPANY" },
      { module: "dispositions", action: "view", dataScope: "COMPANY" },
      { module: "offerings", action: "view", dataScope: "COMPANY" },
    ],
  },
  {
    id: "reporting-analyst",
    name: "Reporting Analyst",
    description: "Data specialist generating pipeline metrics, conversion performance, and executive reports across the workspace.",
    permissions: [
      { module: "reports", action: "view", dataScope: "COMPANY" },
      { module: "reports", action: "export", dataScope: "COMPANY" },
      { module: "leads", action: "view", dataScope: "COMPANY" },
      { module: "leads", action: "export", dataScope: "COMPANY" },
      { module: "customers", action: "view", dataScope: "COMPANY" },
      { module: "audit_logs", action: "view", dataScope: "COMPANY" },
      { module: "offerings", action: "view", dataScope: "COMPANY" },
    ],
  },
];

export const SYSTEM_MODULES = [
  { module: "customers", label: "Customers", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "leads", label: "Leads", actions: ["view", "create", "update", "delete", "assign", "export", "manage"] },
  { module: "offerings", label: "Products & Services", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "dispositions", label: "Dispositions", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "activities", label: "Activities", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "tasks", label: "Follow-ups & Tasks", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "reports", label: "Reports & Analytics", actions: ["view", "export", "manage"] },
  { module: "custom_fields", label: "Custom Fields", actions: ["view", "manage"] },
  { module: "users", label: "User Management", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "teams", label: "Team Management", actions: ["view", "create", "update", "delete", "manage"] },
  { module: "roles", label: "Roles & Permissions", actions: ["view", "manage"] },
  { module: "settings", label: "Company Settings", actions: ["view", "manage"] },
  { module: "audit_logs", label: "Audit Logs", actions: ["view"] },
];

export class RoleService {
  /**
   * List all roles for tenant with member counts and permissions.
   */
  static async listRoles(ctx: AuthContext) {
    const canView =
      ctx.hasPermission("roles", "view") ||
      ctx.hasPermission("roles", "manage") ||
      ctx.hasPermission("settings", "manage");

    if (!canView) {
      throw new ForbiddenError("Permission denied: roles.view required");
    }

    const roles = await prisma.role.findMany({
      where: {
        companyId: ctx.company.id,
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        permissions: {
          select: {
            id: true,
            module: true,
            action: true,
            dataScope: true,
          },
        },
        _count: {
          select: {
            users: { where: { deletedAt: null } },
          },
        },
      },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      userCount: r._count.users,
      permissions: r.permissions,
    }));
  }

  /**
   * Get single role by ID with permissions and assigned users.
   */
  static async getRoleById(ctx: AuthContext, id: string) {
    const canView =
      ctx.hasPermission("roles", "view") ||
      ctx.hasPermission("roles", "manage") ||
      ctx.hasPermission("settings", "manage");

    if (!canView) {
      throw new ForbiddenError("Permission denied: roles.view required");
    }

    const role = await prisma.role.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
      include: {
        permissions: true,
        users: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundError("Role not found");
    }

    return role;
  }

  /**
   * Create a custom role.
   */
  static async createRole(ctx: AuthContext, data: CreateRoleInput) {
    if (!ctx.hasPermission("roles", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: roles.manage required");
    }

    await QuotaService.assertCanUseFeature(ctx.company.id, "customRoles");

    // Privilege delegation guard: creator cannot grant permissions they do not possess
    if (!ctx.role.isSystem || ctx.role.name !== "Admin") {
      for (const perm of data.permissions) {
        if (!ctx.hasPermission(perm.module, perm.action)) {
          throw new ForbiddenError(
            `Privilege escalation rejected: you cannot grant permission ${perm.module}.${perm.action} that you do not possess`
          );
        }
      }
    }

    // Check duplicate name in tenant
    const existing = await prisma.role.findUnique({
      where: {
        companyId_name: {
          companyId: ctx.company.id,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new ValidationError("A role with this name already exists");
    }

    const role = await prisma.$transaction(async (tx) => {
      const newRole = await tx.role.create({
        data: {
          companyId: ctx.company.id,
          name: data.name,
          description: data.description,
          isSystem: false,
          permissions: {
            createMany: {
              data: data.permissions.map((p) => ({
                module: p.module,
                action: p.action,
                dataScope: p.dataScope || DataScope.COMPANY,
              })),
            },
          },
        },
        include: {
          permissions: true,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "role.created",
          entityType: "role",
          entityId: newRole.id,
          metadata: {
            name: newRole.name,
            permissionCount: data.permissions.length,
          },
        },
      });

      return newRole;
    });

    return role;
  }

  /**
   * Update a role (permissions and description).
   */
  static async updateRole(ctx: AuthContext, id: string, data: UpdateRoleInput) {
    if (!ctx.hasPermission("roles", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: roles.manage required");
    }

    const existing = await prisma.role.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
      include: {
        permissions: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Role not found");
    }

    // If system role, name cannot be changed
    if (existing.isSystem && data.name && data.name !== existing.name) {
      throw new ValidationError("System role names cannot be modified");
    }

    // Privilege delegation guard
    if (data.permissions && (!ctx.role.isSystem || ctx.role.name !== "Admin")) {
      for (const perm of data.permissions) {
        if (!ctx.hasPermission(perm.module, perm.action)) {
          throw new ForbiddenError(
            `Privilege escalation rejected: you cannot grant permission ${perm.module}.${perm.action} that you do not possess`
          );
        }
      }
    }

    // Name uniqueness check if renaming
    if (data.name && data.name !== existing.name) {
      const nameConflict = await prisma.role.findUnique({
        where: {
          companyId_name: {
            companyId: ctx.company.id,
            name: data.name,
          },
        },
      });

      if (nameConflict) {
        throw new ValidationError("A role with this name already exists");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update role properties
      const role = await tx.role.update({
        where: { id },
        data: {
          ...(data.name && !existing.isSystem ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });

      // Update permissions if provided
      if (data.permissions) {
        await tx.permission.deleteMany({
          where: { roleId: id },
        });

        await tx.permission.createMany({
          data: data.permissions.map((p) => ({
            roleId: id,
            module: p.module,
            action: p.action,
            dataScope: p.dataScope || DataScope.COMPANY,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "role.updated",
          entityType: "role",
          entityId: id,
          metadata: {
            name: role.name,
            updatedFields: Object.keys(data),
          },
        },
      });

      return tx.role.findUnique({
        where: { id },
        include: { permissions: true },
      });
    });

    return updated;
  }

  /**
   * Delete a custom role.
   */
  static async deleteRole(ctx: AuthContext, id: string) {
    if (!ctx.hasPermission("roles", "manage") && !ctx.hasPermission("settings", "manage")) {
      throw new ForbiddenError("Permission denied: roles.manage required");
    }

    const existing = await prisma.role.findFirst({
      where: {
        id,
        companyId: ctx.company.id,
      },
      include: {
        _count: {
          select: {
            users: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Role not found");
    }

    if (existing.isSystem) {
      throw new ValidationError("System roles cannot be deleted");
    }

    if (existing._count.users > 0) {
      throw new ValidationError(
        `Cannot delete role '${existing.name}' because ${existing._count.users} active user(s) are assigned to it`
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.permission.deleteMany({
        where: { roleId: id },
      });

      await tx.role.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          companyId: ctx.company.id,
          userId: ctx.user.id,
          action: "role.deleted",
          entityType: "role",
          entityId: id,
          metadata: {
            name: existing.name,
          },
        },
      });
    });

    return { success: true, message: "Role deleted successfully" };
  }

  /**
   * Get all system permission definitions available for role assignment.
   */
  static getAvailablePermissions() {
    return SYSTEM_MODULES;
  }

  /**
   * Get plain-language explanations and business rules for all permissions.
   */
  static getPermissionExplanations() {
    return PERMISSION_EXPLANATIONS;
  }

  /**
   * Get standard recommended role presets/templates for quick creation.
   */
  static getRolePresets(): RolePreset[] {
    return ROLE_PRESETS;
  }
}
