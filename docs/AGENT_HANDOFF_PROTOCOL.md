[RULE]

# Agent Handoff Protocol

Agents must not transfer entire conversations or huge logs.

## Required Handoff

```text
FEATURE:
OBJECTIVE:
STATUS:
RELEVANT FILES:
DEPENDENCIES:
CHANGED FILES:
TESTS RUN:
EVIDENCE:
KNOWN RISKS:
BLOCKERS:
NEXT ACTION:
```

## Handoff Rule

The receiving agent should be able to start without asking:
"what were you doing?"

If essential information is missing, the sender failed the handoff.

## Evidence

Prefer:
- file path + symbol;
- test command + result;
- screenshot/evidence path;
- API request + response summary.

Avoid pasting large source files into the handoff.
