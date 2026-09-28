[RULE]

# Final Verification

Run the complete test suite, route/link audit, API contract checks, code health checks, security checks, dependency audit, browser/E2E verification, and production-build validation where applicable. Record evidence per `docs/EVIDENCE_STANDARDS.md` for each check. Fix failures and rerun — do not report a re-run you did not actually perform.

If any check cannot be run in this environment, say so explicitly and mark
the related task `BLOCKED` rather than assuming it would pass.
