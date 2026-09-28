---
name: search-command-architecture
description: "Use when an admin workspace needs search, global search, command palette, or keyboard navigation."
---

# Search & Command Architecture

Separate global search from workspace search.

Global search should identify supported entity types and routes. Workspace search should search the current dataset.

If command palette is used, define commands, permissions, keyboard shortcuts, loading, empty, error, and disabled states.

Do not create a command that bypasses normal authorization.
