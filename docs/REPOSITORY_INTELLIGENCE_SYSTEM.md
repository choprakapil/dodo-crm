[RULE]

# Repository Intelligence / File Knowledge System

## Goal

The agent should not repeatedly rediscover the repository.

Maintain a compact, generated repository knowledge layer.

## Required Artifacts

```text
.harness/
├── repo/
│   ├── REPOSITORY_MAP.md
│   ├── FILE_INDEX.json
│   ├── SYMBOL_INDEX.json
│   ├── ROUTE_INDEX.json
│   ├── API_INDEX.json
│   ├── DB_INDEX.json
│   ├── DEPENDENCY_GRAPH.json
│   ├── PLATFORM_INDEX.json
│   ├── TEST_INDEX.json
│   └── GENERATED_FILES.md
├── context/
│   ├── CURRENT_TASK.md
│   ├── CURRENT_SLICE.md
│   └── decisions/
├── evidence/
└── runs/
```

## File Index

Each meaningful source file should have compact metadata:

```json
{
  "path": "src/features/auth/login.ts",
  "kind": "source",
  "platforms": ["web", "api"],
  "purpose": "login orchestration",
  "exports": ["login"],
  "imports": ["authRepository", "session"],
  "consumers": ["loginRoute", "mobileAuth"],
  "tests": ["login.test.ts"],
  "feature_ids": ["AUTH-001"],
  "risk": "high",
  "last_verified": "..."
}
```

Do not describe every line. Describe ownership and relationships.

## Symbol Index

Index meaningful:
- functions;
- classes;
- components;
- hooks;
- API handlers;
- schemas;
- DB models;
- routes;
- exported constants.

## Dependency Graph

Track:
`file → imports → exports → consumers → routes → tests`

Use this graph to estimate change impact before editing.

## Route Index

Track:
- URL;
- file;
- layout;
- auth;
- metadata;
- API dependencies;
- loading;
- error;
- not-found;
- tests.

## API Index

Track:
- endpoint/action;
- source;
- request schema;
- response schema;
- auth;
- consumers;
- tests;
- rate limits;
- cache policy.

## DB Index

Track:
- model/table;
- owner;
- relations;
- indexes;
- migrations;
- consumers.

## Freshness

Generated indexes must include:
- generated_at;
- repository commit/hash;
- generator version.

Never treat stale repository maps as authoritative.

## When to Refresh

Refresh after:
- major file creation/deletion;
- dependency changes;
- route changes;
- API changes;
- DB schema changes;
- refactors;
- branch switches;
- large merges.

Small edits should update only affected records where possible.
