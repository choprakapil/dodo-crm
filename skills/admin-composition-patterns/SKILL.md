---
name: admin-composition-patterns
description: "Use when composing admin workspaces from shared primitives so screens do not invent a new layout language."
---

# Admin Composition Patterns

Preferred composition:

PageContainer → PageHeader → optional AttentionStrip → optional StatGroup → WorkspaceToolbar → DataSurface → contextual DetailDrawer → Activity/History where needed.

Use canonical project primitives. Create a new primitive only when the behavior is genuinely reusable and absent.
