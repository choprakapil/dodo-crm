# Universal CRM — Disaster Recovery & Restore Runbook
**Phase B.6: Data Safety & Recovery Hardening**
**Status:** Operational Runbook

---

## ⚠️ HARD OPERATIONAL RULE: NEVER RESTORE DIRECTLY TO LIVE PRODUCTION

> [!CAUTION]
> A backup must **NEVER** be restored directly into the live production database instance. Direct in-place restores risk overwriting untargeted tenant transactions, corrupting foreign key references, and creating unrecoverable split-brain states.

Restoration must strictly follow the **7-Step Isolated Staging Pipeline** below.

---

## 1. THE 7-STEP SAFE RESTORE PIPELINE

```
+--------------------------------------------------------------------------+
|  STEP 1: Provision Isolated Target Database                              |
|          Restore dump to a fresh, isolated staging database instance      |
+--------------------------------------------------------------------------+
                                    │
                                    ▼
+--------------------------------------------------------------------------+
|  STEP 2: Verify Schema & Migration State                                 |
|          Run: npx prisma migrate status                                  |
|          Confirm all migrations in _prisma_migrations match application   |
+--------------------------------------------------------------------------+
                                    │
                                    ▼
+--------------------------------------------------------------------------+
|  STEP 3: Entity Count Reconciliation                                     |
|          Confirm expected row counts for companies, users, leads, etc.   |
+--------------------------------------------------------------------------+
                                    │
                                    ▼
+--------------------------------------------------------------------------+
|  STEP 4: Run Data Integrity Verification Script                          |
|          Run: ts-node scripts/verify-backup-restore-integrity.ts         |
|          Must report 12/12 Invariant Checks PASSED                       |
+--------------------------------------------------------------------------+
                                    │
                                    ▼
+--------------------------------------------------------------------------+
|  STEP 5: Validate Application Boot & Probes                              |
|          Start staging application instance pointing to restored DB       |
|          Probe: GET /health (200 OK)                                     |
|          Probe: GET /ready  (200 OK with database: ok)                   |
+--------------------------------------------------------------------------+
                                    │
                                    ▼
+--------------------------------------------------------------------------+
|  STEP 6: Run Automated Smoke & Regression Tests                          |
|          Run: npm test                                                   |
+--------------------------------------------------------------------------+
                                    │
                                    ▼
+--------------------------------------------------------------------------+
|  STEP 7: Controlled Operator Cutover                                     |
|          Drain existing production traffic (read-only maintenance)       |
|          Update application DATABASE_URL to restored instance            |
|          Re-enable public ingress                                        |
+--------------------------------------------------------------------------+
```

---

## 2. STEP-BY-STEP OPERATOR INSTRUCTIONS

### Step 1: Provision Isolated Instance & Restore Dump
```bash
# 1. Create a fresh sandbox database
createdb -h staging-db.internal -U postgres universal_crm_restored

# 2. Restore logical archive using pg_restore
pg_restore -h staging-db.internal -U postgres \
  --no-owner --no-privileges \
  --dbname=universal_crm_restored \
  /backups/universal_crm_snapshot.dump
```

### Step 2: Schema & Migration State Check
```bash
DATABASE_URL="postgresql://postgres:***@staging-db.internal:5432/universal_crm_restored" \
npx prisma migrate status
```
*Expected output*: `Database schema is up to date!`

### Step 3 & 4: Run Automated Integrity Verification
Execute the canonical B.6 verification tool:
```bash
DATABASE_URL="postgresql://postgres:***@staging-db.internal:5432/universal_crm_restored" \
npm run test:integrity # or ts-node scripts/verify-backup-restore-integrity.ts
```
The script validates:
- Database connectivity
- Migration finalization in `_prisma_migrations`
- All 29 expected table schemas
- All 12 tenant-level invariants via `DataIntegrityService`
- Zero orphaned foreign keys

### Step 5: Application Health & Readiness Validation
Point a staging Next.js server to the restored database:
```bash
curl -i http://staging-app.internal:3000/health
# Expected: HTTP/1.1 200 OK, {"status":"ok","liveness":true}

curl -i http://staging-app.internal:3000/ready
# Expected: HTTP/1.1 200 OK, {"status":"ready","readiness":true,"checks":{"database":"ok"}}
```

### Step 6: Automated Smoke Verification
```bash
TEST_DATABASE_URL="postgresql://postgres:***@staging-db.internal:5432/universal_crm_restored" \
npm test
```

### Step 7: Operator Controlled Cutover
1. Put the production application into maintenance mode if capturing final delta.
2. Update production connection pooler / orchestration secrets (`DATABASE_URL`).
3. Deploy / restart application pods.
4. Verify `/ready` probe returns `200 OK`.
5. Release maintenance mode.
