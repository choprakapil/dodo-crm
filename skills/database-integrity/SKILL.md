---
name: database-integrity
description: "Use for any schema change, migration, or query touching relationships or constraints."
---

# Database Integrity

**Purpose:** Protect relationships, constraints, migrations, transactional behavior, and data correctness.

## When to use this skill
Use for any schema change, migration, or query touching relationships or constraints.

## Steps
1. Check `docs/memory/DATABASE.md` for the current schema before changing it.
2. Write migrations that are reversible where possible and safe to run against existing data.
3. Wrap multi-step writes that must succeed or fail together in a transaction.

## Evidence required
The migration file(s) touched and the result of actually running the migration in a real/test environment.

Do not mark work that uses this skill as complete without the evidence above. See `docs/EVIDENCE_STANDARDS.md` for the general evidence rules.
