[RULE]

# Automated Quality Gates

Use deterministic automation for checks that should happen every time.

## Good Candidates

- formatting;
- linting;
- type checking;
- unit tests;
- dependency audit;
- generated index freshness;
- route integrity;
- forbidden debug statements;
- secret scanning;
- build verification.

## Agent-Based Verification

Use an independent agent when reasoning about:
- whether a feature is actually complete;
- whether behavior matches acceptance criteria;
- whether a failure path is handled;
- whether cross-platform behavior is consistent.

## Stop Gate

The workflow should support a final gate that prevents declaring completion if:
- required tests fail;
- build fails;
- spectator fails;
- completion matrix has incomplete applicable surfaces;
- unresolved P0/P1 defects exist.

## Avoid Infinite Loops

Any automatic repair loop must have:
- maximum attempts;
- clear stop condition;
- preserved failure evidence;
- escalation to human when repeated attempts fail.

Never allow:
`agent fixes → tests fail → agent fixes → tests fail`
to run indefinitely.
