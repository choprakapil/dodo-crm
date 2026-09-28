[RULE]

# Agentic Engineering Operating System

## Objective

Turn the project pack into a controlled software-delivery system where agents:
- know what the project is;
- know where code lives;
- know what each file/module does;
- know which files are affected by a change;
- work in bounded tasks;
- verify their own work;
- are independently inspected by a read-only spectator;
- preserve compact project memory;
- minimize unnecessary context/token usage;
- never declare success without evidence.

## Agent Topology

```text
                         PROJECT ORCHESTRATOR
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
       REPOSITORY CARTOGRAPHER  PLAN GUARDIAN   CONTEXT CURATOR
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                         ACTIVE FEATURE SLICE
                                  │
        ┌───────────────┬─────────┼──────────┬──────────────┐
        │               │         │          │              │
     Frontend        Backend     DB       Mobile        Platform
        │               │         │          │              │
        └───────────────┴─────────┼──────────┴──────────────┘
                                  │
                         INTEGRATION ENGINEER
                                  │
                         TEST / RUNTIME AGENT
                                  │
                         ┌────────┴────────┐
                         │                 │
                  SPECTATOR AGENT   SECURITY/SEO/A11Y
                         │                 │
                         └────────┬────────┘
                                  │
                         COMPLETION AUDITOR
                                  │
                           CLOSE + NEXT TASK
```

## Critical Separation of Duties

The agent that writes code should NOT be the only agent deciding whether the code works.

At minimum:
1. Builder implements.
2. Runtime/test agent executes tests and real flows.
3. Spectator independently inspects the resulting repository and behavior.
4. Completion auditor checks evidence against the feature definition of done.

For high-risk changes, the spectator must not modify production code.

## Agent Roles

### Orchestrator
Controls sequencing and handoffs.

### Repository Cartographer
Maintains a factual map of:
- every meaningful source file;
- directory purpose;
- exports;
- imports;
- route ownership;
- API ownership;
- database ownership;
- component relationships;
- platform ownership;
- generated files;
- configuration files;
- tests;
- scripts;
- environment dependencies.

### Plan Guardian
Detects when implementation drifts from the approved master plan.

### Context Curator
Controls what information enters each agent context and keeps context bounded.

### Builder Agents
Implement only the assigned slice.

### Integration Engineer
Checks cross-layer contracts and affected surfaces.

### Runtime/Test Agent
Actually runs the application/tests and records observed behavior.

### Spectator
Independent read-only reviewer that attempts to prove the feature is NOT complete.

### Security/SEO/Accessibility Specialists
Run domain-specific gates.

### Completion Auditor
Makes the final evidence-based decision.

## Spectator Principle

The Spectator's job is not to agree with the builder.

Its default assumption is:

> "There may be a hidden defect. Find it."

It checks:
- dead links;
- dead buttons;
- missing routes;
- broken imports;
- incorrect API contracts;
- stale data;
- missing loading/error states;
- permission leaks;
- responsive failures;
- console errors;
- runtime exceptions;
- hydration problems;
- SEO issues;
- accessibility issues;
- missing admin/mobile implementation;
- unfinished TODOs;
- fake/mock data left in production paths;
- feature flags accidentally disabled;
- environment assumptions;
- missing migrations;
- missing indexes;
- incomplete tests.

The Spectator may return:
- PASS
- PASS WITH WARNINGS
- FAIL
- BLOCKED

It must include evidence.

## Stop Condition

A feature may close only when:
- builder reports complete;
- tests pass;
- runtime verification passes;
- spectator independently passes;
- required specialist gates pass;
- completion auditor passes;
- project state is updated.

No single agent can override a failed independent gate.
