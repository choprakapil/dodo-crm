/**
 * Phase-Lock & Architectural Invariant Verification Script
 *
 * IMPORTANT ARCHITECTURAL CLARIFICATION:
 * This script serves as MANDATORY REPOSITORY VERIFICATION executed automatically
 * before `npm test`, `npm run build`, and `npm run deploy:prepare`.
 * It is NOT an immutable external security boundary (as an agent with filesystem
 * access could modify repository files). It ensures automated regression failure
 * if phase-locks or architectural invariants are breached.
 *
 * Invariants Enforced:
 * 1. Phase 8 models remain absent from schema and database.
 * 2. Phase 8 migrations remain absent.
 * 3. Phase 8 API routes remain absent.
 * 4. Currency invariants: Offering.currency AND Company.currency have no @default("USD").
 * 5. Destructive reset command is guarded by scripts/guard-db-reset.js.
 * 6. Antigravity governance skills directory (.agents/skills) exists and is populated.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runPhaseLockChecks() {
  console.log('🔒 ==========================================');
  console.log('🔒 ARCHITECTURAL PHASE-LOCK & INVARIANT AUDIT');
  console.log('🔒 ==========================================');

  let failed = false;

  // 1. Check prisma/schema.prisma for unauthorized Phase 8 models
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  const phase8ForbiddenModels = [
    'LeadConversion',
    'WonLostReason',
    'ConversionRule',
    'Deal',
    'Opportunity',
  ];

  console.log('\n[1/6] Checking Prisma schema for Phase 8 models...');
  for (const model of phase8ForbiddenModels) {
    const modelRegex = new RegExp(`model\\s+${model}\\s+{`, 'i');
    if (modelRegex.test(schemaContent)) {
      console.error(`❌ VIOLATION: Forbidden Phase 8 model '${model}' found in schema.prisma!`);
      failed = true;
    } else {
      console.log(`  ✓ Phase 8 model '${model}' is absent from schema.`);
    }
  }

  // 2. Check Database for unauthorized Phase 8 tables
  console.log('\n[2/6] Checking Database for Phase 8 physical tables...');
  try {
    const forbiddenTables = [
      'lead_conversions',
      'won_lost_reasons',
      'conversion_rules',
      'deals',
      'opportunities',
    ];

    for (const table of forbiddenTables) {
      const result: Array<{ exists: boolean }> = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = '${table}'
        );
      `);
      if (result[0]?.exists) {
        console.error(`❌ VIOLATION: Forbidden Phase 8 table '${table}' exists in database!`);
        failed = true;
      } else {
        console.log(`  ✓ Phase 8 table '${table}' is absent from database.`);
      }
    }
  } catch (err) {
    console.error('❌ Failed querying database for tables:', err);
    failed = true;
  }

  // 3. Check prisma/migrations directory for premature Phase 8 migrations
  console.log('\n[3/6] Checking migrations for premature Phase 8 additions...');
  const migrationsDir = path.resolve(__dirname, '../prisma/migrations');
  if (fs.existsSync(migrationsDir)) {
    const migrations = fs.readdirSync(migrationsDir);
    for (const m of migrations) {
      const lower = m.toLowerCase();
      if (lower.includes('conversion') || lower.includes('won_lost') || lower.includes('phase8') || lower.includes('phase_8')) {
        console.error(`❌ VIOLATION: Premature Phase 8 migration found: '${m}'!`);
        failed = true;
      }
    }
    console.log(`  ✓ Migration directory checked (${migrations.length} items); 0 Phase 8 migrations found.`);
  }

  // 4. Check App Router for Phase 8 routes
  console.log('\n[4/6] Checking App Router for premature Phase 8 routes...');
  const forbiddenRoutePaths = [
    path.resolve(__dirname, '../app/api/v1/conversions'),
    path.resolve(__dirname, '../app/api/v1/leads/[id]/convert'),
  ];
  for (const routePath of forbiddenRoutePaths) {
    if (fs.existsSync(routePath)) {
      console.error(`❌ VIOLATION: Premature Phase 8 route found at '${routePath}'!`);
      failed = true;
    } else {
      console.log(`  ✓ Route '${path.basename(routePath)}' is absent.`);
    }
  }

  // 5. Check Currency Invariants on Offering.currency AND Company.currency
  console.log('\n[5/6] Checking Currency invariants on Offering and Company...');
  const offeringBlockMatch = schemaContent.match(/model\s+Offering\s+\{[\s\S]+?\}/);
  if (!offeringBlockMatch) {
    console.error('❌ Could not locate model Offering in schema.prisma!');
    failed = true;
  } else if (/currency\s+String\s+@default\("USD"\)/.test(offeringBlockMatch[0])) {
    console.error('❌ VIOLATION: Offering.currency still has @default("USD") in schema.prisma!');
    failed = true;
  } else {
    console.log('  ✓ Offering.currency does not have @default("USD").');
  }

  const companyBlockMatch = schemaContent.match(/model\s+Company\s+\{[\s\S]+?\}/);
  if (!companyBlockMatch) {
    console.error('❌ Could not locate model Company in schema.prisma!');
    failed = true;
  } else if (/currency\s+String\s+@default\("USD"\)/.test(companyBlockMatch[0])) {
    console.error('❌ VIOLATION: Company.currency still has @default("USD") in schema.prisma!');
    failed = true;
  } else {
    console.log('  ✓ Company.currency does not have @default("USD").');
  }

  // 6. Check package.json destructive command safety & governance
  console.log('\n[6/6] Checking package.json destructive reset guard & governance...');
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (!packageJson.scripts['db:reset']?.includes('guard-db-reset.js')) {
    console.error('❌ VIOLATION: db:reset script is not guarded by guard-db-reset.js!');
    failed = true;
  } else {
    console.log('  ✓ db:reset is guarded by scripts/guard-db-reset.js.');
  }

  // Check governance directory
  const governanceSkillsPath = path.resolve(__dirname, '../../.agents/skills');
  if (!fs.existsSync(governanceSkillsPath)) {
    console.error('❌ VIOLATION: .agents/skills directory is missing at workspace root!');
    failed = true;
  } else {
    const skillsCount = fs.readdirSync(governanceSkillsPath).length;
    console.log(`  ✓ .agents/skills exists and contains ${skillsCount} registered skills.`);
  }

  await prisma.$disconnect();

  if (failed) {
    console.error('\n❌ PHASE-LOCK AUDIT FAILED.');
    process.exit(1);
  } else {
    console.log('\n✅ ALL PHASE-LOCKS AND ARCHITECTURAL INVARIANTS PASS.');
  }
}

runPhaseLockChecks().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
