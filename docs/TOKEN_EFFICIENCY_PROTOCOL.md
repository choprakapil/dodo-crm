[RULE]

# Token / Context Efficiency Protocol

## Core Principle

Use the model for reasoning, not as a filesystem.

The repository should provide compact retrieval and evidence.

## Never

- dump the whole repository;
- repeatedly print large files;
- repeatedly inspect unchanged logs;
- send complete build output when the error lines are sufficient;
- ask the same agent to rediscover project architecture;
- keep old implementation chatter in active task context;
- duplicate instructions across dozens of files.

## Prefer

- repository indexes;
- symbol search;
- targeted file ranges;
- dependency graph;
- task-specific context;
- concise failure summaries;
- phase context;
- decision records;
- evidence references.

## Context Hierarchy

```text
Level 0 — Rules
Level 1 — Master plan
Level 2 — Current slice
Level 3 — Relevant repository map
Level 4 — Relevant source/contracts
Level 5 — Tests/evidence
Level 6 — Raw logs only when needed
```

Do not load Level 6 when Level 5 answers the question.

## Context Compression

At the end of a meaningful task:
- summarize decisions;
- summarize modified files;
- summarize tests;
- summarize unresolved issues;
- persist next task;
- remove transient details from active context.

## Stable Facts

Store durable facts in:
`.harness/context/`

Do not repeatedly restate durable facts in prompts.

## Agent Handoff

A handoff should contain only:
- feature ID;
- objective;
- relevant files;
- dependencies;
- current state;
- exact blocker/question;
- evidence links/paths.

## Change Size

Prefer small coherent changes. If a change becomes large, split it into reviewable stages rather than creating one giant context-heavy task.

## Cost-Aware Verification

Use:
- cheap static checks first;
- targeted tests next;
- expensive browser/device/E2E checks last;
- full regression only when risk warrants it.

This reduces wasted model/tool work without reducing required quality.
