/**
 * Master Test Runner for Universal CRM Test Suite (Slices 1, 2, 3, 4, 5, 6, 7, 8)
 */

// CRITICAL POSITIVE TEST DATABASE SAFETY (PHASE B.1): Must be first import
import { enforceTestDatabaseSafety } from "./test-db-guard";

import { runUnitTests } from "./unit.test";
import { runIntegrationTests } from "./integration.test";
import { runTenantSecurityTests } from "./tenant-security.test";
import { runSpectatorAdversarialTests } from "./spectator-adversarial.test";
import { runLeadUnitTests } from "./lead-unit.test";
import { runLeadIntegrationTests } from "./lead-integration.test";
import { runLeadTenantSecurityTests } from "./lead-tenant-security.test";
import { runLeadSpectatorTests } from "./lead-spectator.test";
import { runActivityUnitTests } from "./activity-unit.test";
import { runActivityIntegrationTests } from "./activity-integration.test";
import { runActivityTenantSecurityTests } from "./activity-tenant-security.test";
import { runActivitySpectatorTests } from "./activity-spectator.test";
import { runFollowUpUnitTests } from "./follow-up-unit.test";
import { runFollowUpIntegrationTests } from "./follow-up-integration.test";
import { runFollowUpTenantSecurityTests } from "./follow-up-tenant-security.test";
import { runFollowUpSpectatorTests } from "./follow-up-spectator.test";
import { runCustomFieldUnitTests } from "./custom-field-unit.test";
import { runCustomFieldIntegrationTests } from "./custom-field-integration.test";
import { runCustomFieldTenantSecurityTests } from "./custom-field-tenant-security.test";
import { runCustomFieldSpectatorTests } from "./custom-field-spectator.test";
import { runLeadImportUnitTests } from "./lead-import-unit.test";
import { runLeadImportIntegrationTests } from "./lead-import-integration.test";
import { runLeadImportSecurityTests } from "./lead-import-security.test";
import { runLeadImportSpectatorTests } from "./lead-import-spectator.test";
import { runLeadExportSecurityTests } from "./lead-export-security.test";
import { runAnalyticsUnitTests } from "./analytics-unit.test";
import { runAnalyticsIntegrationTests } from "./analytics-integration.test";
import { runAnalyticsTenantSecurityTests } from "./analytics-tenant-security.test";
import { runAnalyticsSpectatorTests } from "./analytics-spectator.test";
import { runUserTeamUnitTests } from "./user-team-unit.test";
import { runUserTeamIntegrationTests } from "./user-team-integration.test";
import { runUserTeamTenantSecurityTests } from "./user-team-tenant-security.test";
import { runUserTeamSpectatorTests } from "./user-team-spectator.test";
import { runSuperAdminUnitTests } from "./super-admin-unit.test";
import { runSuperAdminIntegrationTests } from "./super-admin-integration.test";
import { runSuperAdminSecurityTests } from "./super-admin-security.test";
import { runCustomerIdentityUnitTests } from "./customer-identity-unit.test";
import { runPhoneNormalizationUnitTests } from "./phone-normalization-unit.test";
import { runCustomerResolutionIntegrationTests } from "./customer-resolution-integration.test";
import { runEnquiryLeadModelIntegrationTests } from "./enquiry-lead-model-integration.test";
import { runCustomerBackfillDryRunTests } from "./customer-backfill-dry-run.test";
import { runCustomerCrudSecurityTests } from "./customer-crud-security.test";
import { runPhase6CreateEnquiryOfferingTests } from "./phase6-create-enquiry-offering.test";
import { runPhase7DispositionFollowUpTests } from "./phase7-disposition-followup.test";
import { runPhaseB0ServiceTests } from "./services-phase-b0.test";
import { runPhaseB1ConfigTests } from "./config-phase-b1.test";
import { runPhaseB2OnboardingTests } from "./onboarding-phase-b2.test";
import { runPhaseB3IndustryTemplateTests } from "./industry-templates-phase-b3.test";
import { runPhaseB4SecurityTests } from "./security-phase-b4.test";
import { runPhaseB5ObservabilityTests } from "./observability-phase-b5.test";
import { runPhaseB6DataSafetyTests } from "./data-safety-phase-b6.test";
import { runPhaseB7ProductionReadinessTests } from "./readiness-phase-b7.test";
import { prisma } from "../lib/db";

async function main() {
  // CRITICAL POSITIVE TEST DATABASE SAFETY (PHASE B.1): Fail closed without explicit TEST_DATABASE_URL
  enforceTestDatabaseSafety();

  console.log("====================================================================");
  console.log("🚀 STARTING UNIVERSAL CRM MASTER TEST SUITE (SLICES 1, 2, 3, 4, 5, 6, 7, 8)");
  console.log("====================================================================");

  const startTime = Date.now();

  try {
    // Slices 1 & 2 Foundations: Auth & Tenancy
    await runUnitTests();
    await runIntegrationTests();
    await runTenantSecurityTests();
    await runSpectatorAdversarialTests();

    // Slice 3: Leads, Pipelines & Dispositions
    await runLeadUnitTests();
    await runLeadIntegrationTests();
    await runLeadTenantSecurityTests();
    await runLeadSpectatorTests();

    // Slice 4: Activities, Notes & Audit Trail
    await runActivityUnitTests();
    await runActivityIntegrationTests();
    await runActivityTenantSecurityTests();
    await runActivitySpectatorTests();

    // Slice 5: Tasks & Follow-ups Engine
    await runFollowUpUnitTests();
    await runFollowUpIntegrationTests();
    await runFollowUpTenantSecurityTests();
    await runFollowUpSpectatorTests();

    // Slice 5 Extension: Custom Fields & Dynamic Forms Engine
    await runCustomFieldUnitTests();
    await runCustomFieldIntegrationTests();
    await runCustomFieldTenantSecurityTests();
    await runCustomFieldSpectatorTests();

    // Slice 5 Extension: Lead Import & Export Engine
    await runLeadImportUnitTests();
    await runLeadImportIntegrationTests();
    await runLeadImportSecurityTests();
    await runLeadImportSpectatorTests();
    await runLeadExportSecurityTests();

    // Slice 6: Reports & Analytics Dashboard
    await runAnalyticsUnitTests();
    await runAnalyticsIntegrationTests();
    await runAnalyticsTenantSecurityTests();
    await runAnalyticsSpectatorTests();

    // Slice 7: User & Team Management + Settings
    await runUserTeamUnitTests();
    await runUserTeamIntegrationTests();
    await runUserTeamTenantSecurityTests();
    await runUserTeamSpectatorTests();

    // Slice 8: Super Admin Platform Console / Tenant Operations / Subscriptions
    await runSuperAdminUnitTests();
    await runSuperAdminIntegrationTests();
    await runSuperAdminSecurityTests();

    // V1.1 Phase 1: Customer Identity & Phone Uniqueness
    await runCustomerIdentityUnitTests();

    // V1.1 Phase 2: Phone Normalization & Customer Resolution
    await runPhoneNormalizationUnitTests();
    await runCustomerResolutionIntegrationTests();

    // V1.1 Phase 3: Enquiry / Lead Model with Customer
    await runEnquiryLeadModelIntegrationTests();

    // V1.1 Phase 4A: Historical Customer Backfill Dry Run & Safety Audit
    await runCustomerBackfillDryRunTests();

    // V1.1 Phase 5: Customer CRUD, Contact Management, RBAC & Data Scope
    await runCustomerCrudSecurityTests();

    // V1.1 Phase 6: Create Enquiry, Offerings, Pricing Engine & Customer History Preview
    await runPhase6CreateEnquiryOfferingTests();

    // V1.1 Phase 7: Disposition Management + Follow-Up Lifecycle Engine
    await runPhase7DispositionFollowUpTests();

    // Phase B.0: Production Service Implementations (Email, Storage, Rate Limiter)
    await runPhaseB0ServiceTests();

    // Phase B.1: Environment & Configuration Hardening
    await runPhaseB1ConfigTests();

    // Phase B.2: Onboarding & Tenant Setup
    await runPhaseB2OnboardingTests();

    // Phase B.3: Industry Templates
    await runPhaseB3IndustryTemplateTests();

    // Phase B.4: Security Re-Check & Deep Audit Suite
    await runPhaseB4SecurityTests();

    // Phase B.5: Observability Foundation
    await runPhaseB5ObservabilityTests();

    // Phase B.6: Data Safety & Recovery Hardening
    await runPhaseB6DataSafetyTests();

    // Phase B.7: Production Readiness & Operational Hardening
    await runPhaseB7ProductionReadinessTests();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n====================================================================");
    console.log(`🎉 ALL SLICE 1 - 8 & PHASES B.0 - B.7 TESTS & SECURITY CHECKS PASSED in ${duration}s!`);
    console.log("====================================================================");
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED WITH ERROR:\n", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
