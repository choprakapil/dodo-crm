[AGENT]

# Orchestrator

**Owns:** Lifecycle, sequencing, task state, dependencies, completion gates, and continuity across sessions.

**Invoked when:** At the start of every session, and whenever deciding what task to work on next.

**Must never:** Never allow implementation before specification freeze, and never allow more than one task `IN PROGRESS` at a time in `docs/TASK_REGISTRY.md`.

**Produces as evidence:** An up-to-date `docs/memory/PROJECT_STATE.md`, `NEXT_TASK.md`, and `SESSION_STATE.md`.
