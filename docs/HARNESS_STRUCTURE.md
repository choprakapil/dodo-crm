[TEMPLATE]

# Agent Harness Structure

Recommended generated project-level structure:

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
│   └── TEST_INDEX.json
├── context/
│   ├── CURRENT_TASK.md
│   ├── CURRENT_SLICE.md
│   ├── PROJECT_FACTS.md
│   └── decisions/
├── phases/
│   └── phase-XX-feature-name.md
├── evidence/
│   ├── screenshots/
│   ├── tests/
│   ├── browser/
│   └── runtime/
├── reviews/
│   ├── spectator/
│   ├── security/
│   ├── accessibility/
│   └── performance/
└── logs/
```

This harness is project memory, not application runtime code.
