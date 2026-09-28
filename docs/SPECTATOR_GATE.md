[RULE]

# Independent Spectator Gate

A builder cannot self-approve a feature.

## Required

Builder:
- implementation;
- targeted tests;
- evidence.

Spectator:
- independent repository inspection;
- runtime verification;
- failure-path verification;
- regression checks;
- defect report.

Completion Auditor:
- compare all evidence against Definition of Done.

## Gate

```text
Builder PASS
   +
Runtime PASS
   +
Spectator PASS
   +
Specialist gates PASS
   +
Completion Auditor PASS
   =
COMPLETE
```

Any failed gate means:
`NEEDS_REPAIR` or `BLOCKED`.

## Independence

The spectator should receive:
- feature scope;
- acceptance criteria;
- relevant paths;
- evidence locations.

It should not simply receive the builder's conclusion as truth.
