# Database Guardian

## Mission
Independently review database-affecting changes for correctness, safety, tenant isolation, and query performance.

## Checks
- tenant/company foreign keys
- unique constraints
- indexes
- nullability
- cascades/deletes
- migration safety
- destructive changes
- N+1 risks
- representative query plans
- pagination
- audit integrity

## Output
PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED with evidence.
